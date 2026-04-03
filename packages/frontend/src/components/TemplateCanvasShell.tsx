import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import * as Y from 'yjs';
import type { YMapEvent } from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { FabricCanvas } from './FabricCanvas';
import { ComposeStreamTimeline } from './ComposeStreamTimeline.tsx';
import styles from './TemplateEditorShell.module.css';
import type { CanvasObjectKind, CanvasObjectRecord } from '../types/canvas';
import type { TemplateFields, TemplateId, TemplatePatch } from '../types/template';
import type { StreamStage, TemplateEditorShellProps } from '../types/templateEditor';
import {
  createDefaultTemplateFields,
  createDefaultTemplateMeta,
  readTemplateFieldsFromMap,
  readTemplateMetaFromMap,
  validateTemplatePatch,
} from '../libs/template/contracts.ts';
import { renderTemplateWithDiagnostics } from '../libs/template/renderTemplate.ts';
import { streamTemplateCompose } from '../libs/template/composeTemplateClient.ts';
import { DEFAULT_TEMPLATE_CANDIDATES, getTemplatePack } from '../libs/template/templatePacks.ts';
import { STAGES, clearStreamStageDones, readStages } from '../libs/template/templateComposeStages.ts';
import { clearTemplateSlotRecordsIfFieldsEmpty, cloneYMap } from '../libs/template/yjsMapUtils.ts';
import { withTemplateFieldFallbacks } from '../libs/template/templateFieldFallbacks.ts';
import { bindFabricCanvasToYMap } from '../libs/canvas/bindYjsToFabric.ts';
import { attachTemplateFabricViewport } from '../libs/canvas/templateFabricViewport.ts';
import {
  DEFAULT_TEMPLATE_ARTBOARD_COLORS,
  fitTemplatePageInViewport,
  isTemplateSlotFabricObject,
  setupTemplateArtboard,
} from '../libs/template/templateArtboard.ts';
import {
  applyTemplateFieldsToFabricObjects,
  isTemplateSlotLaidOut,
  refitTemplateSceneAndRender,
  renderTemplateSlotsToCanvas,
} from '../libs/template/templateCanvasFabric.ts';
import {
  getDesignPaletteRoot,
  getObjectId,
  isDesignPaletteFabricObject,
} from '../libs/canvas/fabricRecords.ts';
import { getTemplateFabricViewLayout } from '../libs/template/templateFabricViewLayout.ts';
import {
  TEMPLATE_FABRIC_OBJECTS_MAP,
  TEMPLATE_HIDDEN_SLOTS_MAP,
} from '../constants/templateEditor.ts';
import {
  createDesignPaletteObject,
  DESIGN_DRAG_MIME,
  DESIGN_PALETTE_ITEMS,
} from '../libs/template/designPaletteFabric.ts';

/** True when this document was loaded via a full browser reload (F5 / refresh), not SPA navigation. */
function isPageReload(): boolean {
  if (typeof performance === 'undefined') return false;

  const entries = performance.getEntriesByType?.('navigation');
  if (entries && entries.length > 0) {
    const nav = entries[0] as PerformanceNavigationTiming;
    if (nav.type === 'reload') return true;
  }

  // Some environments omit the Navigation Timing entry; deprecated API still reports reload.
  const legacy = (performance as unknown as { navigation?: { type?: number } }).navigation;
  if (legacy && typeof legacy.type === 'number' && legacy.type === 1) {
    return true;
  }

  return false;
}

function createBlankTemplateFields(): TemplateFields {
  return {
    ...createDefaultTemplateFields(),
    logos: ['', '', '', '', '', ''],
    steps: [
      { title: '', description: '' },
      { title: '', description: '' },
      { title: '', description: '' },
    ],
  };
}

export function TemplateCanvasShell(props: TemplateEditorShellProps) {
  const artboardColorsForTemplateId = (templateId: TemplateId) => {
    void templateId;
    return DEFAULT_TEMPLATE_ARTBOARD_COLORS;
  };

  const templateCandidatesRef = useRef<TemplateId[]>(DEFAULT_TEMPLATE_CANDIDATES);
  templateCandidatesRef.current = props.templateCandidates ?? DEFAULT_TEMPLATE_CANDIDATES;

  const ydocRef = useRef<Y.Doc | null>(null);
  const metaMapRef = useRef<Y.Map<unknown> | null>(null);
  const fieldsMapRef = useRef<Y.Map<unknown> | null>(null);
  const streamMapRef = useRef<Y.Map<unknown> | null>(null);
  const objectsMapRef = useRef<Y.Map<CanvasObjectRecord> | null>(null);
  const hiddenSlotsMapRef = useRef<Y.Map<unknown> | null>(null);
  const hiddenSlotIdsRef = useRef<ReadonlySet<string>>(new Set());
  const composeAbortRef = useRef<AbortController | null>(null);
  const replaceFieldsPendingRunRef = useRef<string | null>(null);

  const fabricRef = useRef<FabricCanvasType | null>(null);
  const fabricBindingRef = useRef<ReturnType<typeof bindFabricCanvasToYMap> | null>(null);
  const pageOffsetRef = useRef({ pageX: 0, pageY: 0 });
  const lastRenderedTemplateIdRef = useRef<string>('');
  const lastRenderedThemeRef = useRef<string>('');
  const fabricDisposeRef = useRef<(() => void) | null>(null);
  /** Skip resize refit when it matches the last layout from {@link handleFabricReady}. */
  const fabricLayoutKeyRef = useRef<string>('');
  const canSyncTemplateObjectsRef = useRef(false);
  const pendingFabricCanvasRef = useRef<FabricCanvasType | null>(null);
  /** Used by Yjs binding to ignore / drop 0×0 “disabled” slots (e.g. portrait `slot:hero:visual`). */
  const currentTemplatePackRef = useRef(getTemplatePack('landing.v1'));

  /** Run {@link resetSlotLayout} once after reload, only after Yjs sync + Fabric binding exist. */
  const reloadLayoutResetPendingRef = useRef(false);
  const yjsProviderSyncedOnceRef = useRef(false);
  const resetSlotLayoutRef = useRef<() => void>(() => {});
  const tryApplyReloadLayoutResetRef = useRef<() => void>(() => {});

  /** Refit from Yjs fields + apply map; used after resize and when peers delete slot geometry. */
  const refitFabricFromMapsRef = useRef<() => void>(() => {});
  /** Skip observe-driven refit while this tab is doing its own resize+slot-key clear (avoids double work). */
  const suppressTemplateFabricMapObserveRefitRef = useRef(false);
  const fabricMapSlotDeletionRefitRafRef = useRef(0);
  const hiddenSlotsMapObserveRefitRafRef = useRef(0);
  const removeSelectedLayoutRef = useRef<() => void>(() => {});

  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 560 });
  const canvasSizeRef = useRef(canvasSize);
  useLayoutEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  const [statusText, setStatusText] = useState('Ready');
  const [templateId, setTemplateId] = useState<TemplateId>('landing.v1');
  const [templateTheme, setTemplateTheme] = useState(() => createDefaultTemplateMeta().theme);
  const [templateStatus, setTemplateStatus] = useState('idle');
  const [patchCount, setPatchCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [sharedPrompt, setSharedPrompt] = useState(props.initialPrompt ?? '');
  const [stages, setStages] = useState<StreamStage[]>(() =>
    STAGES.map((s) => ({ id: s.id, label: s.label, done: false })),
  );
  const [, setOverflowWarnings] = useState<string[]>([]);
  const [yjsMountEpoch, setYjsMountEpoch] = useState(0);
  const [designPanelTick, setDesignPanelTick] = useState(0);
  const [hasDeletableCanvasSelection, setHasDeletableCanvasSelection] = useState(false);
  const displayPrompt = sharedPrompt.trim().length > 0 ? sharedPrompt : 'default prompt';
  const composeInProgress = templateStatus === 'streaming';
  const stableDocKey =
    props.docId && props.docId.trim().length > 0 ? props.docId.trim() : 'template-default';

  const applyValidatedPatch = (opts: {
    patch: TemplatePatch;
    opId: string;
    stageId?: (typeof STAGES)[number]['id'];
    status?: string;
    replaceAllFields?: boolean;
  }) => {
    const metaMap = metaMapRef.current;
    const fieldsMap = fieldsMapRef.current;
    const streamMap = streamMapRef.current;
    const ydoc = ydocRef.current;
    if (!metaMap || !fieldsMap || !streamMap || !ydoc) return false;

    if (streamMap.get(`op:${opts.opId}`) === true) return false;

    const errors = validateTemplatePatch(opts.patch);
    if (errors.length > 0) {
      ydoc.transact(() => {
        metaMap.set('status', 'error');
        metaMap.set('statusText', `Patch rejected: ${errors[0]}`);
        streamMap.set('done:error', true);
      });
      return false;
    }

    ydoc.transact(() => {
      if (opts.patch.meta) {
        const metaEntries = Object.entries(opts.patch.meta) as Array<[string, unknown]>;
        metaEntries.forEach(([k, v]) => metaMap.set(k, v));
      }
      if (opts.patch.fields) {
        if (opts.replaceAllFields) {
          const blankFields = createBlankTemplateFields();
          const blankEntries = Object.entries(blankFields) as Array<[string, unknown]>;
          blankEntries.forEach(([k, v]) => fieldsMap.set(k, v));
        }
        const fieldEntries = Object.entries(opts.patch.fields) as Array<[string, unknown]>;
        fieldEntries.forEach(([k, v]) => fieldsMap.set(k, v));
      }
      if (opts.stageId) {
        streamMap.set(`done:${opts.stageId}`, true);
      }
      if (opts.status) {
        metaMap.set('statusText', opts.status);
      }
      streamMap.set(`op:${opts.opId}`, true);
      const currentPatchCount =
        typeof metaMap.get('patchCount') === 'number'
          ? (metaMap.get('patchCount') as number)
          : 0;
      metaMap.set('patchCount', currentPatchCount + 1);
    });

    return true;
  };

  const rebuildHiddenSlotIds = useCallback(() => {
    const m = hiddenSlotsMapRef.current;
    const next = new Set<string>();
    m?.forEach((_v, k) => {
      if (typeof k === 'string' && k.startsWith('slot:')) next.add(k);
    });
    hiddenSlotIdsRef.current = next;
  }, []);

  const startComposeStream = () => {
    const metaMap = metaMapRef.current;
    const fieldsMap = fieldsMapRef.current;
    const streamMap = streamMapRef.current;
    const ydoc = ydocRef.current;
    const objectsMap = objectsMapRef.current;
    const hiddenSlotsMap = hiddenSlotsMapRef.current;
    if (!metaMap || !fieldsMap || !streamMap || !ydoc) return;

    composeAbortRef.current?.abort();
    const abortController = new AbortController();
    composeAbortRef.current = abortController;

    const promptValue =
      (typeof metaMap.get('prompt') === 'string' ? (metaMap.get('prompt') as string) : '') ||
      (props.initialPrompt ?? '');
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    replaceFieldsPendingRunRef.current = runId;

    ydoc.transact(() => {
      metaMap.set('runId', runId);
      metaMap.set('status', 'streaming');
      metaMap.set('statusText', 'Streaming compose-template response...');
      metaMap.set('patchCount', 0);
      metaMap.set('prompt', promptValue);
      const clearedFields = createDefaultTemplateFields();
      const clearedEntries = Object.entries(clearedFields) as Array<[string, unknown]>;
      clearedEntries.forEach(([k, v]) => fieldsMap.set(k, v));
      hiddenSlotsMap?.clear();
      if (objectsMap) {
        const slotKeys: string[] = [];
        objectsMap.forEach((_v, k) => {
          if (typeof k === 'string' && k.startsWith('slot:')) slotKeys.push(k);
        });
        for (const k of slotKeys) objectsMap.delete(k);
      }
      clearStreamStageDones(streamMap);
    });
    rebuildHiddenSlotIds();

    const templateCandidates = templateCandidatesRef.current;

    void streamTemplateCompose({
      apiBaseUrl: 'http://localhost:4000',
      signal: abortController.signal,
      req: {
        prompt: promptValue,
        templateCandidates,
      },
      onEvent: (event) => {
        const currentRunId = metaMapRef.current?.get('runId');
        if (currentRunId !== runId) return;
        if (event.type === 'template_selected') {
          applyValidatedPatch({
            opId: event.opId,
            stageId: 'template_selected',
            status: 'Applied template_selected',
            patch: {
              opId: event.opId,
              stage: 'meta_header',
              meta: {
                templateId: event.templateId,
                theme: event.theme,
                status: event.status,
              },
            },
          });
          return;
        }
        if (event.type === 'field_patch') {
          const shouldReplaceAllFields = replaceFieldsPendingRunRef.current === runId;
          const applied = applyValidatedPatch({
            opId: event.opId,
            stageId: 'field_patch',
            status: 'Applied field_patch',
            replaceAllFields: shouldReplaceAllFields,
            patch: {
              opId: event.opId,
              stage: 'steps',
              fields: event.fields,
            },
          });
          if (applied && shouldReplaceAllFields) {
            replaceFieldsPendingRunRef.current = null;
          }
          return;
        }
        if (event.type === 'complete') {
          applyValidatedPatch({
            opId: event.opId,
            stageId: 'complete',
            status: 'Compose complete',
            patch: {
              opId: event.opId,
              stage: 'complete',
              meta: { status: event.status },
            },
          });
          return;
        }
        if (event.type === 'error') {
          const metaMapCurrent = metaMapRef.current;
          const streamMapCurrent = streamMapRef.current;
          const ydocCurrent = ydocRef.current;
          if (!metaMapCurrent || !streamMapCurrent || !ydocCurrent) return;
          ydocCurrent.transact(() => {
            metaMapCurrent.set('status', 'error');
            metaMapCurrent.set('statusText', event.message);
            streamMapCurrent.set('done:error', true);
          });
        }
      },
    }).catch((error: unknown) => {
      if (abortController.signal.aborted) return;
      const metaMapCurrent = metaMapRef.current;
      const streamMapCurrent = streamMapRef.current;
      const ydocCurrent = ydocRef.current;
      if (!metaMapCurrent || !streamMapCurrent || !ydocCurrent) return;
      const message = error instanceof Error ? error.message : 'compose stream failed';
      ydocCurrent.transact(() => {
        metaMapCurrent.set('status', 'error');
        metaMapCurrent.set('statusText', message);
        streamMapCurrent.set('done:error', true);
      });
    });
  };

  const regenerate = () => {
    startComposeStream();
  };

  const addDesignComponentAtCenter = useCallback(
    (kind: CanvasObjectKind) => {
      const canvas = fabricRef.current;
      if (!canvas || composeInProgress) return;
      const p = canvas.getCenterPoint();
      const obj = createDesignPaletteObject(canvas, kind, p.x, p.y);
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
    },
    [composeInProgress],
  );

  const dropDesignPaletteOnCanvas = useCallback(
    (e: globalThis.DragEvent) => {
      e.preventDefault();
      const canvas = fabricRef.current;
      if (!canvas || composeInProgress) return;
      const raw = e.dataTransfer?.getData(DESIGN_DRAG_MIME);
      if (!raw) return;
      const kind = raw as CanvasObjectKind;
      if (!DESIGN_PALETTE_ITEMS.some((item) => item.kind === kind)) return;
      const p = canvas.getScenePoint(e);
      const obj = createDesignPaletteObject(canvas, kind, p.x, p.y);
      canvas.add(obj);
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
    },
    [composeInProgress],
  );

  const onCanvasDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onCanvasDrop = useCallback(
    (e: DragEvent) => {
      dropDesignPaletteOnCanvas(e.nativeEvent);
    },
    [dropDesignPaletteOnCanvas],
  );

  const deleteSelectedLayoutElements = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || composeInProgress) return;
    const ydoc = ydocRef.current;
    const objectsMap = objectsMapRef.current;
    const hiddenSlotsMap = hiddenSlotsMapRef.current;
    if (!ydoc || !objectsMap || !hiddenSlotsMap) return;

    const active = canvas.getActiveObjects();
    const designRoots = new Set<FabricObject>();
    for (const o of active) {
      const r = getDesignPaletteRoot(o);
      if (r) designRoots.add(r);
    }
    const designToRemove = [...designRoots];
    const slotToRemove = active.filter(isTemplateSlotFabricObject);
    if (designToRemove.length === 0 && slotToRemove.length === 0) return;

    ydoc.transact(() => {
      for (const obj of slotToRemove) {
        const id = getObjectId(obj);
        if (!id || !id.startsWith('slot:')) continue;
        hiddenSlotsMap.set(id, true);
        objectsMap.delete(id);
      }
    });
    rebuildHiddenSlotIds();

    for (const o of designToRemove) canvas.remove(o);
    for (const o of slotToRemove) canvas.remove(o);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, [composeInProgress, rebuildHiddenSlotIds]);

  removeSelectedLayoutRef.current = deleteSelectedLayoutElements;

  useEffect(() => {
    const c = fabricRef.current;
    if (!c) return;
    const sync = () => {
      setHasDeletableCanvasSelection(
        c
          .getActiveObjects()
          .some((o) => isDesignPaletteFabricObject(o) || isTemplateSlotFabricObject(o)),
      );
    };
    c.on('selection:created', sync);
    c.on('selection:updated', sync);
    c.on('selection:cleared', sync);
    sync();
    return () => {
      c.off('selection:created', sync);
      c.off('selection:updated', sync);
      c.off('selection:cleared', sync);
    };
  }, [designPanelTick]);

  /** Drops hit the Fabric `<canvas>` layers; host `onDrop` alone is not enough. */
  useEffect(() => {
    const c = fabricRef.current;
    if (!c) return;
    const layers = [c.upperCanvasEl, c.lowerCanvasEl].filter(
      (el): el is HTMLCanvasElement => el instanceof HTMLCanvasElement,
    );
    const onOver = (ev: globalThis.DragEvent) => {
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
    };
    const onDrop = (ev: globalThis.DragEvent) => {
      dropDesignPaletteOnCanvas(ev);
    };
    for (const el of layers) {
      el.addEventListener('dragover', onOver);
      el.addEventListener('drop', onDrop);
    }
    return () => {
      for (const el of layers) {
        el.removeEventListener('dragover', onOver);
        el.removeEventListener('drop', onDrop);
      }
    };
  }, [designPanelTick, dropDesignPaletteOnCanvas]);

  /** Rebuild slot objects at canonical layout positions and drop stored Yjs geometry for those slots. */
  const resetSlotLayout = useCallback(() => {
    const canvas = fabricRef.current;
    const metaMap = metaMapRef.current;
    const fieldsMap = fieldsMapRef.current;
    const objectsMap = objectsMapRef.current;
    const binding = fabricBindingRef.current;
    const ydoc = ydocRef.current;
    if (!canvas || !metaMap || !fieldsMap || !objectsMap || !binding || !ydoc) return;

    const normalizedMeta = readTemplateMetaFromMap(cloneYMap(metaMap));
    const fields = withTemplateFieldFallbacks(
      normalizedMeta.templateId,
      readTemplateFieldsFromMap(cloneYMap(fieldsMap)),
      { enabled: false },
    );
    const pack = getTemplatePack(normalizedMeta.templateId);
    currentTemplatePackRef.current = pack;

    const hiddenSlotsMap = hiddenSlotsMapRef.current;
    ydoc.transact(() => {
      hiddenSlotsMap?.clear();
    });
    rebuildHiddenSlotIds();

    canSyncTemplateObjectsRef.current = false;
    const { pageX, pageY } = refitTemplateSceneAndRender(canvas, pack, fields, {
      artboardColors: artboardColorsForTemplateId(normalizedMeta.templateId),
      theme: normalizedMeta.theme,
      hiddenSlotIds: hiddenSlotIdsRef.current,
    });
    pageOffsetRef.current = { pageX, pageY };

    const slotKeysToDelete: string[] = [];
    objectsMap.forEach((_v, k) => {
      if (k.startsWith('slot:')) slotKeysToDelete.push(k);
    });
    ydoc.transact(() => {
      for (const k of slotKeysToDelete) {
        objectsMap.delete(k);
      }
    });

    binding.applyFromYjs({ animatePositions: false });
    canSyncTemplateObjectsRef.current = true;

    const viewLayout = getTemplateFabricViewLayout(pack);
    fitTemplatePageInViewport(canvas, {
      pageX,
      pageY,
      width: viewLayout.viewW,
      height: viewLayout.viewH,
    });
  }, [rebuildHiddenSlotIds]);

  resetSlotLayoutRef.current = resetSlotLayout;
  tryApplyReloadLayoutResetRef.current = () => {
    if (!reloadLayoutResetPendingRef.current) return;
    if (!yjsProviderSyncedOnceRef.current) return;
    if (!fabricRef.current || !fabricBindingRef.current) return;
    reloadLayoutResetPendingRef.current = false;
    resetSlotLayoutRef.current();
  };

  refitFabricFromMapsRef.current = () => {
    const c = fabricRef.current;
    const meta = metaMapRef.current;
    const fieldsMapCurrent = fieldsMapRef.current;
    const binding = fabricBindingRef.current;
    const ydocCurrent = ydocRef.current;
    const objectsMapCurrent = objectsMapRef.current;
    if (!c || !meta || !fieldsMapCurrent || !binding || !ydocCurrent || !objectsMapCurrent) return;

    rebuildHiddenSlotIds();
    const normalizedMeta = readTemplateMetaFromMap(cloneYMap(meta));
    const fields = withTemplateFieldFallbacks(
      normalizedMeta.templateId,
      readTemplateFieldsFromMap(cloneYMap(fieldsMapCurrent)),
      { enabled: false },
    );
    const pack = getTemplatePack(normalizedMeta.templateId);
    currentTemplatePackRef.current = pack;
    canSyncTemplateObjectsRef.current = false;
    const { pageX, pageY } = refitTemplateSceneAndRender(c, pack, fields, {
      artboardColors: artboardColorsForTemplateId(normalizedMeta.templateId),
      theme: normalizedMeta.theme,
      hiddenSlotIds: hiddenSlotIdsRef.current,
    });
    pageOffsetRef.current = { pageX, pageY };
    clearTemplateSlotRecordsIfFieldsEmpty(ydocCurrent, objectsMapCurrent, fields);
    binding.applyFromYjs({ animatePositions: false });
    canSyncTemplateObjectsRef.current = true;
    const viewLayout = getTemplateFabricViewLayout(pack);
    fitTemplatePageInViewport(c, {
      pageX,
      pageY,
      width: viewLayout.viewW,
      height: viewLayout.viewH,
    });
  };

  useLayoutEffect(() => {
    const safeDocId =
      props.docId && props.docId.trim().length > 0 ? props.docId.trim() : 'template-default';
    const roomName = `yjs?doc=${safeDocId}`;

    reloadLayoutResetPendingRef.current = isPageReload();
    yjsProviderSyncedOnceRef.current = false;

    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider('ws://localhost:4000', roomName, ydoc, { connect: true });
    ydocRef.current = ydoc;

    const metaMap = ydoc.getMap<unknown>('templateMeta');
    const fieldsMap = ydoc.getMap<unknown>('templateFields');
    const streamMap = ydoc.getMap<unknown>('templateStream');
    const objectsMap = ydoc.getMap<CanvasObjectRecord>(TEMPLATE_FABRIC_OBJECTS_MAP);
    const hiddenSlotsMap = ydoc.getMap<unknown>(TEMPLATE_HIDDEN_SLOTS_MAP);
    metaMapRef.current = metaMap;
    fieldsMapRef.current = fieldsMap;
    streamMapRef.current = streamMap;
    objectsMapRef.current = objectsMap;
    hiddenSlotsMapRef.current = hiddenSlotsMap;
    const nextHidden = new Set<string>();
    hiddenSlotsMap.forEach((_v, k) => {
      if (typeof k === 'string' && k.startsWith('slot:')) nextHidden.add(k);
    });
    hiddenSlotIdsRef.current = nextHidden;
    setYjsMountEpoch((n) => n + 1);

    const onHiddenSlotsChanged = () => {
      const m = hiddenSlotsMapRef.current;
      const next = new Set<string>();
      m?.forEach((_v, k) => {
        if (typeof k === 'string' && k.startsWith('slot:')) next.add(k);
      });
      hiddenSlotIdsRef.current = next;
      cancelAnimationFrame(hiddenSlotsMapObserveRefitRafRef.current);
      hiddenSlotsMapObserveRefitRafRef.current = requestAnimationFrame(() => {
        hiddenSlotsMapObserveRefitRafRef.current = 0;
        refitFabricFromMapsRef.current();
      });
    };
    hiddenSlotsMap.observe(onHiddenSlotsChanged);

    const onTemplateFabricObjectsChanged = (e: YMapEvent<CanvasObjectRecord>) => {
      for (const key of e.keysChanged) {
        if (typeof key !== 'string' || !key.startsWith('slot:')) continue;
        if (objectsMap.has(key)) continue;
        if (suppressTemplateFabricMapObserveRefitRef.current) return;
        cancelAnimationFrame(fabricMapSlotDeletionRefitRafRef.current);
        fabricMapSlotDeletionRefitRafRef.current = requestAnimationFrame(() => {
          fabricMapSlotDeletionRefitRafRef.current = 0;
          refitFabricFromMapsRef.current();
        });
        return;
      }
    };
    objectsMap.observe(onTemplateFabricObjectsChanged);

    const syncLocalFromMaps = () => {
      const promptValue =
        typeof metaMap.get('prompt') === 'string' ? (metaMap.get('prompt') as string) : '';
      const normalizedMeta = readTemplateMetaFromMap(cloneYMap(metaMap));
      currentTemplatePackRef.current = getTemplatePack(normalizedMeta.templateId);
      const normalizedFields = withTemplateFieldFallbacks(
        normalizedMeta.templateId,
        readTemplateFieldsFromMap(cloneYMap(fieldsMap)),
        { enabled: false },
      );
      const diagnostics = renderTemplateWithDiagnostics(
        getTemplatePack(normalizedMeta.templateId),
        normalizedFields,
      ).diagnostics;
      setSharedPrompt(promptValue);
      setStages(readStages(streamMap));
      setTemplateId(normalizedMeta.templateId);
      setTemplateTheme(normalizedMeta.theme);
      setTemplateStatus(normalizedMeta.status);
      setPatchCount(
        typeof metaMap.get('patchCount') === 'number'
          ? (metaMap.get('patchCount') as number)
          : 0,
      );
      setOverflowWarnings(diagnostics.overflowWarnings);
      setStatusText(
        typeof metaMap.get('statusText') === 'string'
          ? (metaMap.get('statusText') as string)
          : 'Ready',
      );
    };

    const syncFabricLayoutForTemplateChange = (
      normalizedMeta: ReturnType<typeof readTemplateMetaFromMap>,
    ) => {
      const canvas = fabricRef.current;
      const fieldsMapCurrent = fieldsMapRef.current;
      if (!canvas || !fieldsMapCurrent) return;
      const sameTemplate = normalizedMeta.templateId === lastRenderedTemplateIdRef.current;
      const sameTheme = normalizedMeta.theme === lastRenderedThemeRef.current;
      if (sameTemplate && sameTheme) {
        return;
      }
      if (!sameTemplate) {
        ydoc.transact(() => hiddenSlotsMapRef.current?.clear());
        hiddenSlotIdsRef.current = new Set();
      }
      lastRenderedTemplateIdRef.current = normalizedMeta.templateId;
      lastRenderedThemeRef.current = normalizedMeta.theme;
      const normalizedFields = withTemplateFieldFallbacks(
        normalizedMeta.templateId,
        readTemplateFieldsFromMap(cloneYMap(fieldsMapCurrent)),
        { enabled: false },
      );
      const pack = getTemplatePack(normalizedMeta.templateId);
      currentTemplatePackRef.current = pack;
      canSyncTemplateObjectsRef.current = false;
      const { pageX, pageY } = refitTemplateSceneAndRender(canvas, pack, normalizedFields, {
        artboardColors: artboardColorsForTemplateId(normalizedMeta.templateId),
        theme: normalizedMeta.theme,
        hiddenSlotIds: hiddenSlotIdsRef.current,
      });
      pageOffsetRef.current = { pageX, pageY };
      clearTemplateSlotRecordsIfFieldsEmpty(ydoc, objectsMap, normalizedFields);
      fabricBindingRef.current?.applyFromYjs({ animatePositions: false });
      canSyncTemplateObjectsRef.current = true;
      const viewLayout = getTemplateFabricViewLayout(pack);
      fitTemplatePageInViewport(canvas, {
        pageX,
        pageY,
        width: viewLayout.viewW,
        height: viewLayout.viewH,
      });
    };

    const syncFabricTextFromFields = () => {
      const canvas = fabricRef.current;
      const metaMapCurrent = metaMapRef.current;
      const fieldsMapCurrent = fieldsMapRef.current;
      if (!canvas || !metaMapCurrent || !fieldsMapCurrent) return;
      const normalizedMeta = readTemplateMetaFromMap(cloneYMap(metaMapCurrent));
      const normalizedFields = withTemplateFieldFallbacks(
        normalizedMeta.templateId,
        readTemplateFieldsFromMap(cloneYMap(fieldsMapCurrent)),
        { enabled: false },
      );
      const pack = getTemplatePack(normalizedMeta.templateId);
      currentTemplatePackRef.current = pack;
      const hidden = hiddenSlotsMapRef.current;
      const nextHidden = new Set<string>();
      hidden?.forEach((_v, k) => {
        if (typeof k === 'string' && k.startsWith('slot:')) nextHidden.add(k);
      });
      hiddenSlotIdsRef.current = nextHidden;
      const hasRenderedTemplateSlots = canvas.getObjects().some((obj) => isTemplateSlotFabricObject(obj));
      if (!hasRenderedTemplateSlots) {
        canSyncTemplateObjectsRef.current = false;
        const { pageX, pageY } = refitTemplateSceneAndRender(canvas, pack, normalizedFields, {
          artboardColors: artboardColorsForTemplateId(normalizedMeta.templateId),
          theme: normalizedMeta.theme,
          hiddenSlotIds: hiddenSlotIdsRef.current,
        });
        pageOffsetRef.current = { pageX, pageY };
        clearTemplateSlotRecordsIfFieldsEmpty(ydoc, objectsMap, normalizedFields);
        fabricBindingRef.current?.applyFromYjs({ animatePositions: false });
        canSyncTemplateObjectsRef.current = true;
        const viewLayout = getTemplateFabricViewLayout(pack);
        fitTemplatePageInViewport(canvas, {
          pageX,
          pageY,
          width: viewLayout.viewW,
          height: viewLayout.viewH,
        });
        return;
      }
      applyTemplateFieldsToFabricObjects(
        canvas,
        pack,
        normalizedFields,
        normalizedMeta.theme,
        hiddenSlotIdsRef.current,
      );
      clearTemplateSlotRecordsIfFieldsEmpty(ydoc, objectsMap, normalizedFields);
    };

    const onMeta = () => {
      syncLocalFromMaps();
      const normalizedMeta = readTemplateMetaFromMap(cloneYMap(metaMap));
      syncFabricLayoutForTemplateChange(normalizedMeta);
    };
    const onFields = () => {
      syncLocalFromMaps();
      syncFabricTextFromFields();
    };
    const onStream = () => {
      syncLocalFromMaps();
    };
    metaMap.observe(onMeta as (evt: unknown) => void);
    fieldsMap.observe(onFields as (evt: unknown) => void);
    streamMap.observe(onStream as (evt: unknown) => void);
    syncLocalFromMaps();

    provider.on('status', (event: { status: string }) => {
      setIsConnected(event.status === 'connected');
    });

    provider.on('sync', (isSynced: boolean) => {
      if (!isSynced) return;

      yjsProviderSyncedOnceRef.current = true;
      tryApplyReloadLayoutResetRef.current();

      const alreadyInitialized = metaMap.get('initialized') === true;
      ydoc.transact(() => {
        if (metaMap.get('initialized') === true) return;
        const initialPrompt = props.initialPrompt ?? '';
        const defaultMeta = createDefaultTemplateMeta();
        const defaultFields = createDefaultTemplateFields();
        metaMap.set('initialized', true);
        metaMap.set('templateId', defaultMeta.templateId);
        metaMap.set('theme', defaultMeta.theme);
        metaMap.set('version', defaultMeta.version);
        metaMap.set('prompt', initialPrompt);
        metaMap.set('status', 'idle');
        metaMap.set('statusText', 'Ready');
        metaMap.set('patchCount', 0);
        const fieldEntries = Object.entries(defaultFields) as Array<[string, unknown]>;
        fieldEntries.forEach(([k, v]) => fieldsMap.set(k, v));
        clearStreamStageDones(streamMap);
      });

      syncLocalFromMaps();

      if (!alreadyInitialized) {
        startComposeStream();
      }
    });

    return () => {
      cancelAnimationFrame(fabricMapSlotDeletionRefitRafRef.current);
      fabricMapSlotDeletionRefitRafRef.current = 0;
      cancelAnimationFrame(hiddenSlotsMapObserveRefitRafRef.current);
      hiddenSlotsMapObserveRefitRafRef.current = 0;
      hiddenSlotsMap.unobserve(onHiddenSlotsChanged);
      objectsMap.unobserve(onTemplateFabricObjectsChanged);
      setYjsMountEpoch(0);
      composeAbortRef.current?.abort();
      fabricDisposeRef.current?.();
      fabricDisposeRef.current = null;
      fabricBindingRef.current = null;
      fabricRef.current = null;
      metaMap.unobserve(onMeta as (evt: unknown) => void);
      fieldsMap.unobserve(onFields as (evt: unknown) => void);
      streamMap.unobserve(onStream as (evt: unknown) => void);
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      metaMapRef.current = null;
      fieldsMapRef.current = null;
      streamMapRef.current = null;
      objectsMapRef.current = null;
      hiddenSlotsMapRef.current = null;
      hiddenSlotIdsRef.current = new Set();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.docId]);

  useEffect(() => {
    const el = canvasWrapRef.current;
    if (!el) return;

    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height);
        if (w < 16 || h < 16) return;
        setCanvasSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    const key = `${canvasSize.w}x${canvasSize.h}`;
    if (fabricLayoutKeyRef.current === key) return;

    const t = window.setTimeout(() => {
      const c = fabricRef.current;
      const binding = fabricBindingRef.current;
      if (!c || !binding || !metaMapRef.current || !fieldsMapRef.current) return;
      if (canvasSize.w < 16 || canvasSize.h < 16) return;
      if (fabricLayoutKeyRef.current === key) return;

      suppressTemplateFabricMapObserveRefitRef.current = true;
      const ydoc = ydocRef.current;
      const objectsMap = objectsMapRef.current;
      if (ydoc && objectsMap) {
        ydoc.transact(() => {
          const slotKeys: string[] = [];
          objectsMap.forEach((_v, k) => {
            if (typeof k === 'string' && k.startsWith('slot:')) slotKeys.push(k);
          });
          for (const k of slotKeys) {
            objectsMap.delete(k);
          }
        });
      }
      refitFabricFromMapsRef.current();
      queueMicrotask(() => {
        suppressTemplateFabricMapObserveRefitRef.current = false;
      });
      fabricLayoutKeyRef.current = key;
    }, 100);

    return () => window.clearTimeout(t);
  }, [canvasSize.w, canvasSize.h]);

  const handleBeforeFabricDispose = useCallback(() => {
    fabricDisposeRef.current?.();
    fabricDisposeRef.current = null;
    fabricBindingRef.current = null;
    fabricRef.current = null;
    pendingFabricCanvasRef.current = null;
  }, []);

  const handleFabricReady = useCallback((canvas: FabricCanvasType) => {
    const metaMap = metaMapRef.current;
    const fieldsMap = fieldsMapRef.current;
    const ymap = objectsMapRef.current;
    if (!metaMap || !fieldsMap || !ymap) {
      pendingFabricCanvasRef.current = canvas;
      return;
    }
    pendingFabricCanvasRef.current = null;
    fabricRef.current = canvas;
    if (fabricBindingRef.current) return;

    const { w, h } = canvasSizeRef.current;
    canvas.setDimensions({ width: w, height: h });
    canvas.calcOffset();

    const initialMeta = readTemplateMetaFromMap(cloneYMap(metaMap));
    currentTemplatePackRef.current = getTemplatePack(initialMeta.templateId);

    const { pageX, pageY } = setupTemplateArtboard(
      canvas,
      artboardColorsForTemplateId(initialMeta.templateId),
    );
    pageOffsetRef.current = { pageX, pageY };

    canSyncTemplateObjectsRef.current = false;
    const binding = bindFabricCanvasToYMap({
      canvas,
      ymap,
      shouldPreserveObject: (obj) => {
        if (!isTemplateSlotFabricObject(obj)) return false;
        const id = getObjectId(obj);
        if (!id) return false;
        if (hiddenSlotIdsRef.current.has(id)) return false;
        const slot = currentTemplatePackRef.current.slots.find((s) => s.id === id);
        return Boolean(slot && isTemplateSlotLaidOut(slot));
      },
      shouldSyncId: (id) => {
        if (hiddenSlotIdsRef.current.has(id)) return false;
        if (!id.startsWith('slot:')) return true;
        const slot = currentTemplatePackRef.current.slots.find((s) => s.id === id);
        return Boolean(slot && isTemplateSlotLaidOut(slot));
      },
      shouldSyncObject: (obj) => {
        if (!canSyncTemplateObjectsRef.current) return false;
        if (isDesignPaletteFabricObject(obj)) return true;
        if (!isTemplateSlotFabricObject(obj)) return false;
        const id = getObjectId(obj);
        if (id && hiddenSlotIdsRef.current.has(id)) return false;
        const slot = id
          ? currentTemplatePackRef.current.slots.find((s) => s.id === id)
          : undefined;
        return Boolean(slot && isTemplateSlotLaidOut(slot));
      },
      mapRecordForUpsert: ({ rec }) => {
        const { pageX: px, pageY: py } = pageOffsetRef.current;
        return {
          ...rec,
          left: rec.left - px,
          top: rec.top - py,
          coordSpace: 'page',
        };
      },
      mapRecordForApply: ({ id, rec }) => {
        const { pageX: px, pageY: py } = pageOffsetRef.current;
        let next: CanvasObjectRecord = { ...rec };
        if (rec.coordSpace === 'page') {
          next = {
            ...next,
            left: rec.left + px,
            top: rec.top + py,
          };
        }
        if (id === 'slot:final:cta') {
          next = { ...next, scaleX: 1, scaleY: 1 };
        }
        return next;
      },
    });
    fabricBindingRef.current = binding;

    const normalizedMeta = initialMeta;
    const normalizedFields = withTemplateFieldFallbacks(
      normalizedMeta.templateId,
      readTemplateFieldsFromMap(cloneYMap(fieldsMap)),
      { enabled: false },
    );
    lastRenderedTemplateIdRef.current = normalizedMeta.templateId;
    lastRenderedThemeRef.current = normalizedMeta.theme;
    rebuildHiddenSlotIds();
    renderTemplateSlotsToCanvas(
      canvas,
      getTemplatePack(normalizedMeta.templateId),
      normalizedFields,
      pageX,
      pageY,
      normalizedMeta.theme,
      hiddenSlotIdsRef.current,
    );
    const ydocForSlots = ydocRef.current;
    const objectsMapForSlots = objectsMapRef.current;
    if (ydocForSlots && objectsMapForSlots) {
      clearTemplateSlotRecordsIfFieldsEmpty(ydocForSlots, objectsMapForSlots, normalizedFields);
    }
    binding.applyFromYjs({ animatePositions: false });
    canSyncTemplateObjectsRef.current = true;

    const pack = getTemplatePack(normalizedMeta.templateId);
    const viewLayout = getTemplateFabricViewLayout(pack);
    fitTemplatePageInViewport(canvas, {
      pageX,
      pageY,
      width: viewLayout.viewW,
      height: viewLayout.viewH,
    });
    fabricLayoutKeyRef.current = `${canvas.width}x${canvas.height}`;

    // Reload only: reset after Yjs has merged `templateFabricObjects` (see provider `sync`).
    tryApplyReloadLayoutResetRef.current();

    const detachViewport = attachTemplateFabricViewport(canvas);

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
      const single = canvas.getActiveObject() as unknown as { isEditing?: boolean };
      if (single?.isEditing) return;
      removeSelectedLayoutRef.current();
    };
    window.addEventListener('keydown', onKeyDown);

    fabricDisposeRef.current = () => {
      window.removeEventListener('keydown', onKeyDown);
      binding.destroy();
      detachViewport();
    };

    queueMicrotask(() => {
      setDesignPanelTick((n) => n + 1);
    });
  }, [rebuildHiddenSlotIds]);

  useEffect(() => {
    if (yjsMountEpoch === 0) return;
    const pending = pendingFabricCanvasRef.current;
    if (!pending || !objectsMapRef.current) return;
    if (fabricBindingRef.current) return;
    handleFabricReady(pending);
  }, [yjsMountEpoch, handleFabricReady]);

  return (
    <div className={styles.editor}>
      <header className={styles.topbar}>
        <div className={styles.titleWrap}>
          <div className={styles.title}>Template editor (canvas)</div>
          <div className={styles.sub}>Prompt: {displayPrompt}</div>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            onClick={resetSlotLayout}
            disabled={composeInProgress}
            title="Snap all template slots back to the designed layout (clears saved positions)"
          >
            Reset layout
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={regenerate}
            disabled={composeInProgress}
          >
            Regenerate composition
          </button>
        </div>
      </header>
      <div className={styles.workbench}>
        <main className={`${styles.stage} ${styles.stageFabric}`}>
          <div
            ref={canvasWrapRef}
            className={styles.fabricCanvasHost}
            onDragOver={onCanvasDragOver}
            onDrop={onCanvasDrop}
          >
            <FabricCanvas
              key={stableDocKey}
              className={styles.fabricCanvasElement}
              backgroundColor={DEFAULT_TEMPLATE_ARTBOARD_COLORS.pasteboard}
              skipOffscreen={false}
              width={canvasSize.w}
              height={canvasSize.h}
              onReady={handleFabricReady}
              onBeforeDispose={handleBeforeFabricDispose}
            />
          </div>
        </main>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTop}>
            <div className={styles.kv}>
              <span>Template</span>
              <strong>{templateId}</strong>
            </div>
            <div className={styles.kv}>
              <span>Theme</span>
              <strong>{templateTheme}</strong>
            </div>
            <div className={styles.kv}>
              <span>Pages</span>
              <strong>1</strong>
            </div>
            <div className={styles.kv}>
              <span>Status</span>
              <strong>{templateStatus}</strong>
            </div>
            <div className={styles.kv}>
              <span>Patch count</span>
              <strong>{patchCount}</strong>
            </div>
            <div className={styles.kv}>
              <span>Data source</span>
              <strong>OpenAI compose-template</strong>
            </div>
            <div className={styles.kv}>
              <span>Sync</span>
              <strong>{isConnected ? 'connected' : 'connecting'}</strong>
            </div>
            <div className={styles.kv}>
              <span>Canvas</span>
              <strong>Wheel zoom · Alt+drag pan</strong>
            </div>
            <ComposeStreamTimeline
              stages={stages}
              streaming={templateStatus === 'streaming'}
              composeFailed={templateStatus === 'error'}
              statusText={statusText}
            />
          </div>
          <div className={styles.sidebarComponents}>
            <div className={styles.section}>
              <h3>Components</h3>
              <p className={styles.note}>
                Drag onto the canvas or click to add at the viewport center. Delete or Backspace removes
                the selected palette item or generated template slot.
              </p>
              <div className={styles.paletteGrid}>
                {DESIGN_PALETTE_ITEMS.map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    className={styles.paletteItem}
                    disabled={composeInProgress}
                    draggable={!composeInProgress}
                    title={item.hint}
                    onDragStart={(e) => {
                      e.dataTransfer.setData(DESIGN_DRAG_MIME, item.kind);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => addDesignComponentAtCenter(item.kind)}
                  >
                    <span className={styles.paletteItemLabel}>{item.label}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={styles.paletteDeleteBtn}
                disabled={composeInProgress || !hasDeletableCanvasSelection}
                onClick={deleteSelectedLayoutElements}
              >
                Delete selected
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
