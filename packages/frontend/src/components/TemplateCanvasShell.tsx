import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Canvas as FabricCanvasType, FabricObject } from 'fabric';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { FabricCanvas } from './FabricCanvas';
import styles from './TemplateEditorShell.module.css';
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
import { STAGES, readStages } from '../libs/template/templateComposeStages.ts';
import { cloneYMap } from '../libs/template/yjsMapUtils.ts';
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
  refitTemplateSceneAndRender,
  renderTemplateSlotsToCanvas,
} from '../libs/template/templateCanvasFabric.ts';
import { getTemplateFabricViewLayout } from '../libs/template/templateFabricViewLayout.ts';
import { TEMPLATE_FABRIC_OBJECTS_MAP } from '../constants/templateEditor.ts';
import type { CanvasObjectRecord } from '../types/canvas';

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
  const filterIgnoredMissingFields = (id: TemplateId, slots: string[]) => {
    if (id !== 'landing.v1') return slots;
    const ignored = new Set(['slot:logo:4', 'slot:logo:5', 'slot:logo:6']);
    return slots.filter((slotId) => !ignored.has(slotId));
  };

  const artboardColorsForTemplateId = (_templateId: TemplateId) => DEFAULT_TEMPLATE_ARTBOARD_COLORS;

  const templateCandidatesRef = useRef<TemplateId[]>(DEFAULT_TEMPLATE_CANDIDATES);
  templateCandidatesRef.current = props.templateCandidates ?? DEFAULT_TEMPLATE_CANDIDATES;

  const ydocRef = useRef<Y.Doc | null>(null);
  const metaMapRef = useRef<Y.Map<unknown> | null>(null);
  const fieldsMapRef = useRef<Y.Map<unknown> | null>(null);
  const streamMapRef = useRef<Y.Map<unknown> | null>(null);
  const objectsMapRef = useRef<Y.Map<CanvasObjectRecord> | null>(null);
  const composeAbortRef = useRef<AbortController | null>(null);
  const replaceFieldsPendingRunRef = useRef<string | null>(null);

  const fabricRef = useRef<FabricCanvasType | null>(null);
  const fabricBindingRef = useRef<ReturnType<typeof bindFabricCanvasToYMap> | null>(null);
  const pageOffsetRef = useRef({ pageX: 0, pageY: 0 });
  const lastRenderedTemplateIdRef = useRef<string>('');
  const fabricDisposeRef = useRef<(() => void) | null>(null);
  /** Skip resize refit when it matches the last layout from {@link handleFabricReady}. */
  const fabricLayoutKeyRef = useRef<string>('');
  const canSyncTemplateObjectsRef = useRef(false);
  const pendingFabricCanvasRef = useRef<FabricCanvasType | null>(null);

  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 560 });
  const canvasSizeRef = useRef(canvasSize);
  useLayoutEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  const [, setStatusText] = useState('Ready');
  const [templateId, setTemplateId] = useState<TemplateId>('landing.v1');
  const [templateTheme, setTemplateTheme] = useState(() => createDefaultTemplateMeta().theme);
  const [templateStatus, setTemplateStatus] = useState('idle');
  const [patchCount, setPatchCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [sharedPrompt, setSharedPrompt] = useState(props.initialPrompt ?? '');
  const [stages, setStages] = useState<StreamStage[]>(() =>
    STAGES.map((s) => ({ id: s.id, label: s.label, done: false })),
  );
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [, setOverflowWarnings] = useState<string[]>([]);
  const [yjsMountEpoch, setYjsMountEpoch] = useState(0);
  const displayPrompt = sharedPrompt.trim().length > 0 ? sharedPrompt : 'default prompt';
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

  const startComposeStream = () => {
    const metaMap = metaMapRef.current;
    const fieldsMap = fieldsMapRef.current;
    const streamMap = streamMapRef.current;
    const ydoc = ydocRef.current;
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
      STAGES.forEach((stage) => streamMap.set(`done:${stage.id}`, false));
    });

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

  useLayoutEffect(() => {
    const safeDocId =
      props.docId && props.docId.trim().length > 0 ? props.docId.trim() : 'template-default';
    const roomName = `yjs?doc=${safeDocId}`;
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider('ws://localhost:4000', roomName, ydoc, { connect: true });
    ydocRef.current = ydoc;

    const metaMap = ydoc.getMap<unknown>('templateMeta');
    const fieldsMap = ydoc.getMap<unknown>('templateFields');
    const streamMap = ydoc.getMap<unknown>('templateStream');
    const objectsMap = ydoc.getMap<CanvasObjectRecord>(TEMPLATE_FABRIC_OBJECTS_MAP);
    metaMapRef.current = metaMap;
    fieldsMapRef.current = fieldsMap;
    streamMapRef.current = streamMap;
    objectsMapRef.current = objectsMap;
    setYjsMountEpoch((n) => n + 1);

    const syncLocalFromMaps = () => {
      const promptValue =
        typeof metaMap.get('prompt') === 'string' ? (metaMap.get('prompt') as string) : '';
      const normalizedMeta = readTemplateMetaFromMap(cloneYMap(metaMap));
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
      setMissingFields(filterIgnoredMissingFields(normalizedMeta.templateId, diagnostics.missingFields));
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
      if (normalizedMeta.templateId === lastRenderedTemplateIdRef.current) return;
      lastRenderedTemplateIdRef.current = normalizedMeta.templateId;
      const normalizedFields = withTemplateFieldFallbacks(
        normalizedMeta.templateId,
        readTemplateFieldsFromMap(cloneYMap(fieldsMapCurrent)),
        { enabled: false },
      );
      const pack = getTemplatePack(normalizedMeta.templateId);
      canSyncTemplateObjectsRef.current = false;
      const { pageX, pageY } = refitTemplateSceneAndRender(canvas, pack, normalizedFields, {
        artboardColors: artboardColorsForTemplateId(normalizedMeta.templateId),
      });
      pageOffsetRef.current = { pageX, pageY };
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
      const hasRenderedTemplateSlots = canvas.getObjects().some((obj) => isTemplateSlotFabricObject(obj));
      if (!hasRenderedTemplateSlots) {
        canSyncTemplateObjectsRef.current = false;
        const { pageX, pageY } = refitTemplateSceneAndRender(canvas, pack, normalizedFields, {
          artboardColors: artboardColorsForTemplateId(normalizedMeta.templateId),
        });
        pageOffsetRef.current = { pageX, pageY };
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
      applyTemplateFieldsToFabricObjects(canvas, pack, normalizedFields);
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
        STAGES.forEach((stage) => streamMap.set(`done:${stage.id}`, false));
      });

      syncLocalFromMaps();

      if (!alreadyInitialized) {
        startComposeStream();
      }
    });

    return () => {
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
      const meta = metaMapRef.current;
      const fieldsMap = fieldsMapRef.current;
      const binding = fabricBindingRef.current;
      if (!c || !meta || !fieldsMap || !binding) return;
      if (canvasSize.w < 16 || canvasSize.h < 16) return;
      if (fabricLayoutKeyRef.current === key) return;

      const normalizedMeta = readTemplateMetaFromMap(cloneYMap(meta));
      const fields = withTemplateFieldFallbacks(
        normalizedMeta.templateId,
        readTemplateFieldsFromMap(cloneYMap(fieldsMap)),
        { enabled: false },
      );
      const pack = getTemplatePack(normalizedMeta.templateId);
      canSyncTemplateObjectsRef.current = false;
      const { pageX, pageY } = refitTemplateSceneAndRender(c, pack, fields, {
        artboardColors: artboardColorsForTemplateId(normalizedMeta.templateId),
      });
      pageOffsetRef.current = { pageX, pageY };
      binding.applyFromYjs({ animatePositions: false });
      canSyncTemplateObjectsRef.current = true;
      const viewLayout = getTemplateFabricViewLayout(pack);
      fitTemplatePageInViewport(c, {
        pageX,
        pageY,
        width: viewLayout.viewW,
        height: viewLayout.viewH,
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

    const { pageX, pageY } = setupTemplateArtboard(
      canvas,
      artboardColorsForTemplateId(readTemplateMetaFromMap(cloneYMap(metaMap)).templateId),
    );
    pageOffsetRef.current = { pageX, pageY };

    canSyncTemplateObjectsRef.current = false;
    const binding = bindFabricCanvasToYMap({
      canvas,
      ymap,
      shouldPreserveObject: (obj) => isTemplateSlotFabricObject(obj),
      shouldSyncObject: (obj) =>
        canSyncTemplateObjectsRef.current && isTemplateSlotFabricObject(obj),
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

    const normalizedMeta = readTemplateMetaFromMap(cloneYMap(metaMap));
    const normalizedFields = withTemplateFieldFallbacks(
      normalizedMeta.templateId,
      readTemplateFieldsFromMap(cloneYMap(fieldsMap)),
      { enabled: false },
    );
    lastRenderedTemplateIdRef.current = normalizedMeta.templateId;
    renderTemplateSlotsToCanvas(
      canvas,
      getTemplatePack(normalizedMeta.templateId),
      normalizedFields,
      pageX,
      pageY,
    );
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
      const active = canvas.getActiveObjects();
      active.forEach((obj: FabricObject) => {
        if (isTemplateSlotFabricObject(obj)) return;
        canvas.remove(obj);
      });
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    };
    window.addEventListener('keydown', onKeyDown);

    fabricDisposeRef.current = () => {
      window.removeEventListener('keydown', onKeyDown);
      binding.destroy();
      detachViewport();
    };
  }, []);

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
          <button type="button" className={styles.btn} onClick={regenerate}>
            Regenerate composition
          </button>
        </div>
      </header>
      <div className={styles.workbench}>
        <main className={`${styles.stage} ${styles.stageFabric}`}>
          <div ref={canvasWrapRef} className={styles.fabricCanvasHost}>
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
          <div className={styles.section}>
            <h3>Stream events</h3>
            <ul className={styles.streamList}>
              {stages.map((stage) => (
                <li
                  key={stage.id}
                  className={`${styles.streamItem} ${stage.done ? styles.streamItemDone : ''}`}
                >
                  {stage.done ? '✓' : '…'} {stage.label}
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.section}>
            <h3>Missing fields</h3>
            <div className={styles.list}>
              {missingFields.length > 0 ? missingFields.join(', ') : 'none'}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
