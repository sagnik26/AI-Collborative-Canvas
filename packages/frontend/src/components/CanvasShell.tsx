import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Group, Textbox } from 'fabric';
import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import { FabricCanvas } from './FabricCanvas';
import styles from './CanvasShell.module.css';
import type { ToolId } from '../types/canvas';
import { bindYjsToFabricCanvas } from '../libs/canvas/bindYjsToFabric';
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
  const [activeCount, setActiveCount] = useState(0);
  const [activeObject, setActiveObject] = useState<FabricObject | null>(null);
  const [size, setSize] = useState({ w: CANVAS_MIN_W, h: CANVAS_MIN_H });
  const [activeTool, setActiveTool] = useState<ToolId>('select');

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

  const onReady = useCallback((c: FabricCanvasType) => {
    fabricRef.current = c;
    const yjsBinding = bindYjsToFabricCanvas({
      canvas: c,
      wsBaseUrl: 'ws://localhost:4000',
      room: 'yjs?doc=default',
      mapName: 'objects',
    });

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
    };
  }, []);

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

      <div className={styles.workbench}>
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
          <div ref={wrapperRef} className={styles.canvasWrap}>
            <FabricCanvas
              className={styles.canvas}
              width={size.w}
              height={size.h}
              onReady={onReady}
            />
          </div>
        </main>

        <aside className={styles.rightPanel}>
          <div className={styles.panelHeader}>Properties</div>
          {props ? (
            <div className={styles.panelBody}>
              <div className={styles.fieldRow}>
                <label className={styles.label}>X</label>
                <input
                  className={styles.input}
                  type="number"
                  value={props.left}
                  onChange={(e) =>
                    updateActiveObject({ left: Number(e.target.value) })
                  }
                />
              </div>
              <div className={styles.fieldRow}>
                <label className={styles.label}>Y</label>
                <input
                  className={styles.input}
                  type="number"
                  value={props.top}
                  onChange={(e) =>
                    updateActiveObject({ top: Number(e.target.value) })
                  }
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.label}>W</div>
                <div className={styles.readonly}>{props.width}</div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.label}>H</div>
                <div className={styles.readonly}>{props.height}</div>
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.label}>Fill</label>
                <input
                  className={styles.input}
                  value={props.fill}
                  onChange={(e) => updateActiveObject({ fill: e.target.value })}
                  placeholder="e.g. #6d28d9"
                />
              </div>

              {'text' in (activeObject ?? {}) ? (
                <>
                  <div className={styles.fieldCol}>
                    <label className={styles.label}>Text</label>
                    <textarea
                      className={styles.textarea}
                      value={props.text}
                      onChange={(e) =>
                        updateActiveObject({ text: e.target.value })
                      }
                      rows={4}
                    />
                  </div>
                  {props.fontSize !== null ? (
                    <div className={styles.fieldRow}>
                      <label className={styles.label}>Font</label>
                      <input
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
            <div className={styles.panelEmpty}>
              Select a single object to edit its properties.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
