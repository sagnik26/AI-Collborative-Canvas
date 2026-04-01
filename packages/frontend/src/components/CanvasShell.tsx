import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Textbox } from 'fabric';
import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import { FabricCanvas } from './FabricCanvas';
import styles from './CanvasShell.module.css';
import { PromptBar } from './PromptBar';
import type { ToolId } from '../types/canvas';
import { bindYjsToFabricCanvas } from '../libs/canvas/bindYjsToFabric';
import {
  buildAiLayoutElementsFromCanvas,
  requestAiLayout,
} from '../libs/ai/aiLayoutClient.ts';
import {
  createArrow,
  createLabeledCircle,
  createLabeledRect,
  createLine,
  createText,
} from '../libs/canvas/fabricFactories';

const CANVAS_MIN_W = 720;
const CANVAS_MIN_H = 520;

export function CanvasShell() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const fabricRef = useRef<FabricCanvasType | null>(null);
  const yjsBindingRef = useRef<ReturnType<typeof bindYjsToFabricCanvas> | null>(
    null,
  );
  const [activeCount, setActiveCount] = useState(0);
  const [activeObject, setActiveObject] = useState<FabricObject | null>(null);
  const [size, setSize] = useState({ w: CANVAS_MIN_W, h: CANVAS_MIN_H });
  const [activeTool, setActiveTool] = useState<ToolId>('select');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatusText, setAiStatusText] = useState<string>('');
  const [yjsReady, setYjsReady] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(true);
  type PromptMessage = {
    id: string;
    text: string;
    status: 'pending' | 'done' | 'error';
  };
  const nextPromptIdRef = useRef(1);
  const [promptMessages, setPromptMessages] = useState<PromptMessage[]>([]);

  const toolBtnClass = (id: ToolId) =>
    `${styles.toolBtn} ${activeTool === id ? styles.toolBtnActive : ''}`;

  const computeSize = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Keep a little padding for the wrapper border.
    const w = Math.max(CANVAS_MIN_W, Math.floor(rect.width));
    const h = Math.max(CANVAS_MIN_H, Math.floor(rect.height));
    setSize({ w, h });
  }, []);

  useEffect(() => {
    computeSize();
    window.addEventListener('resize', computeSize);
    return () => window.removeEventListener('resize', computeSize);
  }, [computeSize]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => computeSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeSize]);

  const nudgeViewportToKeepObjectsVisible = useCallback(() => {
    const c = fabricRef.current;
    if (!c) return;
    const objs = c.getObjects() as FabricObject[];
    if (objs.length === 0) return;

    const margin = 18;
    const w = size.w;
    const h = size.h;

    const bounds = objs.reduce(
      (acc, o) => {
        const r = o.getBoundingRect();
        const left = r.left;
        const top = r.top;
        const right = r.left + r.width;
        const bottom = r.top + r.height;
        return {
          minX: Math.min(acc.minX, left),
          minY: Math.min(acc.minY, top),
          maxX: Math.max(acc.maxX, right),
          maxY: Math.max(acc.maxY, bottom),
        };
      },
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      },
    );

    // Only pan (no zoom) to keep content within the viewport.
    const vt = (c.viewportTransform ?? [1, 0, 0, 1, 0, 0]).slice() as number[];
    const zoom = typeof c.getZoom === 'function' ? c.getZoom() : 1;
    const viewMinX = (-vt[4]) / zoom;
    const viewMinY = (-vt[5]) / zoom;
    const viewMaxX = viewMinX + w / zoom;
    const viewMaxY = viewMinY + h / zoom;

    let dx = 0;
    let dy = 0;

    if (bounds.maxX > viewMaxX - margin) dx = bounds.maxX - (viewMaxX - margin);
    if (bounds.minX < viewMinX + margin) dx = bounds.minX - (viewMinX + margin);
    if (bounds.maxY > viewMaxY - margin) dy = bounds.maxY - (viewMaxY - margin);
    if (bounds.minY < viewMinY + margin) dy = bounds.minY - (viewMinY + margin);

    if (dx !== 0 || dy !== 0) {
      vt[4] -= dx * zoom;
      vt[5] -= dy * zoom;
      c.setViewportTransform(vt as [number, number, number, number, number, number]);
      c.requestRenderAll();
    }
  }, [size.h, size.w]);

  useEffect(() => {
    // After layout/size changes (e.g. chat toggle), keep shapes reachable.
    const id = window.requestAnimationFrame(() => {
      nudgeViewportToKeepObjectsVisible();
    });
    return () => window.cancelAnimationFrame(id);
  }, [chatCollapsed, nudgeViewportToKeepObjectsVisible, size.h, size.w]);

  const onReady = useCallback((c: FabricCanvasType) => {
    fabricRef.current = c;
    const yjsBinding = bindYjsToFabricCanvas({
      canvas: c,
      wsBaseUrl: 'ws://localhost:4000',
      room: 'yjs?doc=default',
      mapName: 'objects',
    });
    yjsBindingRef.current = yjsBinding;
    setYjsReady(false);

    const syncPoll = window.setInterval(() => {
      const b = yjsBindingRef.current;
      if (!b) return;
      if (b.isSynced()) {
        setYjsReady(true);
        window.clearInterval(syncPoll);
      }
    }, 200);

    const updateActive = () => {
      const active = c.getActiveObjects();
      setActiveCount(active.length);
      setActiveObject(active.length === 1 ? (active[0] as FabricObject) : null);
    };

    // Canva-like grouping UX:
    // - Single click/drag: move the whole group
    // - Double click: drill in to edit inner text (Textbox)
    const onMouseDown = (opt: unknown) => {
      const anyOpt = opt as { subTargets?: FabricObject[] };
      const sub = anyOpt.subTargets?.[0];
      const parent = sub?.group as unknown as FabricObject | undefined;
      if (!parent) return;
      c.setActiveObject(parent);
      c.requestRenderAll();
    };

    const onMouseDblClick = (opt: unknown) => {
      const anyOpt = opt as {
        subTargets?: FabricObject[];
        target?: FabricObject;
      };
      const sub = anyOpt.subTargets?.[0];
      const target = anyOpt.target;

      const candidate =
        (sub instanceof Textbox && sub) ||
        (target instanceof Textbox && target) ||
        (target instanceof Group
          ? (target.getObjects().find((o) => o instanceof Textbox) as
              | Textbox
              | undefined)
          : undefined);

      if (candidate) {
        c.setActiveObject(candidate);
        const editable = candidate as unknown as {
          enterEditing?: () => void;
          selectAll?: () => void;
        };
        editable.enterEditing?.();
        editable.selectAll?.();
        c.requestRenderAll();
      }
    };

    c.on('selection:created', updateActive);
    c.on('selection:updated', updateActive);
    c.on('selection:cleared', updateActive);
    c.on('object:modified', updateActive);
    c.on('object:moving', updateActive);
    c.on('object:scaling', updateActive);
    c.on('text:changed', updateActive);
    c.on('mouse:down', onMouseDown);
    c.on('mouse:dblclick', onMouseDblClick);

    // Delete key support.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const single = c.getActiveObject() as unknown as { isEditing?: boolean };
      if (single?.isEditing) return;

      const active = c.getActiveObjects();
      if (active.length === 0) return;
      active.forEach((obj: FabricObject) => c.remove(obj));
      c.discardActiveObject();
      c.requestRenderAll();
      setActiveCount(0);
      setActiveObject(null);
    };
    window.addEventListener('keydown', onKeyDown);

    // Start with an empty canvas on first load/refresh.
    c.requestRenderAll();

    return () => {
      window.clearInterval(syncPoll);
      window.removeEventListener('keydown', onKeyDown);
      c.off('selection:created', updateActive);
      c.off('selection:updated', updateActive);
      c.off('selection:cleared', updateActive);
      c.off('object:modified', updateActive);
      c.off('object:moving', updateActive);
      c.off('object:scaling', updateActive);
      c.off('text:changed', updateActive);
      c.off('mouse:down', onMouseDown);
      c.off('mouse:dblclick', onMouseDblClick);
      yjsBinding.destroy();
      yjsBindingRef.current = null;
    };
  }, []);

  const runAiLayout = useCallback(
    async (instruction: string) => {
      const canvas = fabricRef.current;
      const binding = yjsBindingRef.current;
      if (!canvas || !binding) return;

      if (!binding.isSynced()) {
        setAiStatusText('Syncing… try again in a moment.');
        return;
      }

      const promptId = String(nextPromptIdRef.current++);
      setPromptMessages((m): PromptMessage[] => {
        const newMsg: PromptMessage = {
          id: promptId,
          text: instruction,
          status: 'pending',
        };
        return [...m, newMsg].slice(-5);
      });

      setAiLoading(true);
      setAiStatusText('Thinking…');
      try {
        const yRecordsById = binding.getRecordsById();
        const elements = buildAiLayoutElementsFromCanvas(canvas, yRecordsById);
        const objectCount = canvas.getObjects().length;
        if (elements.length === 0 && objectCount > 0) {
          setAiStatusText(
            'Shapes are visible but could not be read for AI. Try refreshing the page.',
          );
          return;
        }
        const result = await requestAiLayout({
          apiBaseUrl: 'http://localhost:4000',
          req: {
            roomId: binding.getRoomId(),
            instruction,
            elements,
            canvasWidth: size.w,
            canvasHeight: size.h,
            doc: 'default',
            mapName: 'objects',
          },
        });
        const hasMoves = result.elements.length > 0;
        const hasCreates = result.creates.length > 0;
        if (!hasMoves && !hasCreates) {
          setAiStatusText(
            result.reasoning ||
              'No changes. Try asking to add a shape (e.g. “add a circle”) or to rearrange existing ones.',
          );
        } else {
          setAiStatusText('');
        }
        setPromptMessages((m): PromptMessage[] =>
          m.map((msg) =>
            msg.id === promptId ? { ...msg, status: 'done' } : msg,
          ),
        );
      } catch (e) {
        setAiStatusText(e instanceof Error ? e.message : 'AI layout failed');
        setPromptMessages((m): PromptMessage[] =>
          m.map((msg) =>
            msg.id === promptId ? { ...msg, status: 'error' } : msg,
          ),
        );
        throw e;
      } finally {
        setAiLoading(false);
      }
    },
    [size.h, size.w],
  );

  const setActive = useCallback((obj: FabricObject) => {
    const c = fabricRef.current;
    if (!c) return;
    c.setActiveObject(obj);
    c.requestRenderAll();
  }, []);

  const actions = useMemo(
    () => ({
      select: () => {
        const c = fabricRef.current;
        if (!c) return;
        c.discardActiveObject();
        c.requestRenderAll();
        setActiveCount(0);
        setActiveObject(null);
      },
      addRect: () => {
        const c = fabricRef.current;
        if (!c) return;
        const r = createLabeledRect(c);
        c.add(r);
        setActive(r);
        c.requestRenderAll();
      },
      addCircle: () => {
        const c = fabricRef.current;
        if (!c) return;
        const circ = createLabeledCircle(c);
        c.add(circ);
        setActive(circ);
        c.requestRenderAll();
      },
      addText: () => {
        const c = fabricRef.current;
        if (!c) return;
        const t = createText(c);
        c.add(t);
        setActive(t);
        c.requestRenderAll();
      },
      addLine: () => {
        const c = fabricRef.current;
        if (!c) return;
        const l = createLine(c);
        c.add(l);
        setActive(l);
        c.requestRenderAll();
      },
      addArrow: () => {
        const c = fabricRef.current;
        if (!c) return;
        const a = createArrow(c);
        c.add(a);
        setActive(a);
        c.requestRenderAll();
      },
      clear: () => {
        const c = fabricRef.current;
        if (!c) return;
        const single = c.getActiveObject() as unknown as {
          isEditing?: boolean;
        };
        if (single?.isEditing) return;

        const active = c.getActiveObjects();
        if (active.length === 0) return;
        active.forEach((obj: FabricObject) => c.remove(obj));
        c.discardActiveObject();
        c.requestRenderAll();
        setActiveCount(0);
        setActiveObject(null);
      },
      zoomReset: () => {
        const c = fabricRef.current;
        if (!c) return;
        c.getObjects().forEach((o: FabricObject) => c.remove(o));
        c.discardActiveObject();
        c.setViewportTransform([1, 0, 0, 1, 0, 0]);
        c.setZoom(1);
        c.requestRenderAll();
        setActiveCount(0);
        setActiveObject(null);
      },
    }),
    [setActive],
  );

  const props = useMemo(() => {
    if (!activeObject) return null;
    const left = typeof activeObject.left === 'number' ? activeObject.left : 0;
    const top = typeof activeObject.top === 'number' ? activeObject.top : 0;
    const width =
      typeof activeObject.getScaledWidth === 'function'
        ? activeObject.getScaledWidth()
        : 0;
    const height =
      typeof activeObject.getScaledHeight === 'function'
        ? activeObject.getScaledHeight()
        : 0;
    const fill =
      typeof (activeObject as unknown as { fill?: unknown }).fill === 'string'
        ? (activeObject as unknown as { fill: string }).fill
        : '';
    const text =
      typeof (activeObject as unknown as { text?: unknown }).text === 'string'
        ? (activeObject as unknown as { text: string }).text
        : '';
    const fontSize =
      typeof (activeObject as unknown as { fontSize?: unknown }).fontSize ===
      'number'
        ? (activeObject as unknown as { fontSize: number }).fontSize
        : null;
    return {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.round(width),
      height: Math.round(height),
      fill,
      text,
      fontSize,
    };
  }, [activeObject]);

  const updateActiveObject = useCallback(
    (
      patch: Partial<{
        left: number;
        top: number;
        fill: string;
        text: string;
        fontSize: number;
      }>,
    ) => {
      const c = fabricRef.current;
      const obj = activeObject;
      if (!c || !obj) return;

      if (typeof patch.left === 'number') obj.set('left', patch.left);
      if (typeof patch.top === 'number') obj.set('top', patch.top);
      if (typeof patch.fill === 'string') obj.set('fill', patch.fill);
      if (typeof patch.text === 'string' && 'text' in obj) {
        obj.set('text', patch.text);
      }
      if (typeof patch.fontSize === 'number' && 'fontSize' in obj) {
        obj.set('fontSize', patch.fontSize);
      }
      obj.setCoords();
      c.requestRenderAll();
      setActiveObject(obj);
    },
    [activeObject],
  );

  return (
    <div className={styles.editor}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandTitle}>AI Collaborative Canvas</div>
        </div>
        <div className={styles.topActions}>
          <button
            className={styles.topBtn}
            onClick={() => setChatCollapsed((v) => !v)}
            type="button"
            aria-label={chatCollapsed ? 'Expand chat' : 'Collapse chat'}
            title={chatCollapsed ? 'Expand chat' : 'Collapse chat'}
          >
            {chatCollapsed ? 'Show chat' : 'Hide chat'}
          </button>
          <button
            className={`${styles.topBtn} ${styles.topBtnPrimary}`}
            onClick={actions.zoomReset}
          >
            Reset view
          </button>
          <button
            className={activeCount > 0 ? styles.topBtnDanger : styles.topBtn}
            onClick={actions.clear}
          >
            Clear
          </button>
        </div>
      </header>

      <div
        className={`${styles.workbench} ${chatCollapsed ? styles.workbenchChatCollapsed : ''}`}
      >
        <aside className={styles.leftRail}>
          <div className={styles.railGroup}>
            <div className={styles.railLabel}>Tools</div>
            <button
              className={toolBtnClass('select')}
              onClick={() => {
                setActiveTool('select');
                actions.select();
              }}
              title="Select"
              aria-label="Select"
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M5 3l14 8-8 2 2 8-3 1-2-8-3 5z" fill="currentColor" />
              </svg>
            </button>

            <button
              className={toolBtnClass('rect')}
              onClick={() => {
                setActiveTool('rect');
                actions.addRect();
              }}
              title="Rectangle"
              aria-label="Rectangle"
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect
                  x="5"
                  y="7"
                  width="14"
                  height="10"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>

            <button
              className={toolBtnClass('circle')}
              onClick={() => {
                setActiveTool('circle');
                actions.addCircle();
              }}
              title="Circle"
              aria-label="Circle"
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle
                  cx="12"
                  cy="12"
                  r="6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>

            <button
              className={toolBtnClass('text')}
              onClick={() => {
                setActiveTool('text');
                actions.addText();
              }}
              title="Text"
              aria-label="Text"
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 7V5h12v2h-5v12h-2V7z" fill="currentColor" />
              </svg>
            </button>

            <button
              className={toolBtnClass('line')}
              onClick={() => {
                setActiveTool('line');
                actions.addLine();
              }}
              title="Line"
              aria-label="Line"
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M6 17L18 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <button
              className={toolBtnClass('arrow')}
              onClick={() => {
                setActiveTool('arrow');
                actions.addArrow();
              }}
              title="Arrow"
              aria-label="Arrow"
              type="button"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M6 16L16 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M14.5 8H16v1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </aside>

        <main className={styles.stage}>
          <section className={styles.propsBar} aria-label="Properties">
            {props ? (
              <div className={styles.propsBarBody}>
                <div className={styles.coordsRow}>
                  <div className={styles.kvField}>
                    <label className={styles.kvKey} htmlFor="prop-x">
                      X
                    </label>
                    <input
                      id="prop-x"
                      className={styles.kvInput}
                      type="number"
                      value={props.left}
                      onChange={(e) =>
                        updateActiveObject({ left: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className={styles.kvField}>
                    <label className={styles.kvKey} htmlFor="prop-y">
                      Y
                    </label>
                    <input
                      id="prop-y"
                      className={styles.kvInput}
                      type="number"
                      value={props.top}
                      onChange={(e) =>
                        updateActiveObject({ top: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className={styles.kvFieldReadonly}>
                    <div className={styles.kvKey}>W</div>
                    <div className={styles.kvReadonly}>{props.width}</div>
                  </div>
                  <div className={styles.kvFieldReadonly}>
                    <div className={styles.kvKey}>H</div>
                    <div className={styles.kvReadonly}>{props.height}</div>
                  </div>

                  <div className={styles.kvFieldFill}>
                    <label className={styles.kvKey} htmlFor="prop-fill">
                      Fill
                    </label>
                    <input
                      id="prop-fill"
                      className={styles.kvInputAuto}
                      value={props.fill}
                      onChange={(e) =>
                        updateActiveObject({ fill: e.target.value })
                      }
                      placeholder="#6d28d9"
                      style={{
                        width: `${Math.max(
                          9,
                          Math.min(22, (props.fill || '#6d28d9').length + 2),
                        )}ch`,
                      }}
                    />
                  </div>
                </div>

                {'text' in (activeObject ?? {}) ? (
                  <>
                    <div className={styles.propsFieldWide}>
                      <label className={styles.label} htmlFor="prop-text">
                        Text
                      </label>
                      <input
                        id="prop-text"
                        className={styles.input}
                        value={props.text}
                        onChange={(e) =>
                          updateActiveObject({ text: e.target.value })
                        }
                        placeholder="Edit text…"
                      />
                    </div>
                    {props.fontSize !== null ? (
                      <div className={styles.propsField}>
                        <label className={styles.label} htmlFor="prop-font">
                          Font
                        </label>
                        <input
                          id="prop-font"
                          className={styles.input}
                          type="number"
                          value={props.fontSize}
                          onChange={(e) =>
                            updateActiveObject({
                              fontSize: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <div className={styles.propsBarEmpty}>
                Select a single object to edit its properties.
              </div>
            )}
          </section>

          <div
            ref={wrapperRef}
            className={`${styles.canvasWrap} ${aiLoading ? styles.canvasWrapLoading : ''}`}
          >
            <FabricCanvas
              className={styles.canvas}
              width={size.w}
              height={size.h}
              onReady={onReady}
            />
          </div>

          {chatCollapsed ? (
            <button
              className={styles.chatFloatingBtn}
              onClick={() => setChatCollapsed(false)}
              type="button"
              aria-label="Expand chat"
              title="Expand chat"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path
                  d="M7 10h10M7 14h6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M5 6h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
        </main>

        {!chatCollapsed ? (
          <aside className={styles.rightChat} aria-label="Chat">
            <PromptBar
              disabled={aiLoading || !yjsReady}
              statusText={
                !yjsReady ? 'Connecting…' : aiLoading ? 'Loading…' : aiStatusText
              }
              onSubmit={runAiLayout}
              variant="chat"
              historyMessages={promptMessages}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
