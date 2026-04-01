import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import styles from './TemplateEditorShell.module.css';
import type { TemplatePatch } from '../types/template';
import {
  createDefaultTemplateFields,
  createDefaultTemplateMeta,
  readTemplateFieldsFromMap,
  readTemplateMetaFromMap,
  validateTemplatePatch,
} from '../libs/template/contracts.ts';
import { LANDING_TEMPLATE_V1 } from '../libs/template/templatePackV1.ts';
import { renderTemplateWithDiagnostics } from '../libs/template/renderTemplate.ts';
import { streamTemplateCompose } from '../libs/template/composeTemplateClient.ts';

type PreviewData = {
  title: string;
  subtitle: string;
  challenge: string[];
  service: string[];
  metrics: string[];
  summary: string;
  cta: string;
  brand: string;
};

type StreamStage = {
  id: string;
  label: string;
  done: boolean;
};

const A4_BASE_WIDTH = 700;
const A4_BASE_HEIGHT = 990;
const STAGES = [
  { id: 'template_selected', label: 'template_selected' },
  { id: 'field_patch', label: 'field_patch' },
  { id: 'complete', label: 'complete' },
  { id: 'error', label: 'error' },
] as const;

function cloneYMap<T>(ymap: Y.Map<T>) {
  const out = new Map<string, T>();
  ymap.forEach((v, k) => out.set(k, v));
  return out;
}

function createStreamingSeed(prompt: string): PreviewData {
  return {
    brand: 'Generating...',
    title: prompt.trim().length > 0 ? prompt : 'Generating headline...',
    subtitle: 'Generating subtitle...',
    challenge: ['Generating...', 'Generating...', 'Generating...'],
    service: ['Generating...', 'Generating...', 'Generating...'],
    metrics: ['...', '...', '...'],
    summary: 'Waiting for streamed content patches...',
    cta: 'Generating...',
  };
}

function toPreviewData(fields: ReturnType<typeof createDefaultTemplateFields>): PreviewData {
  return {
    brand: fields.socialProofTitle,
    title: fields.heroHeadline,
    subtitle: fields.heroSubheadline,
    challenge: fields.steps.map((step) => step.description),
    service: fields.logos.map((logo) => `Logo: ${logo}`),
    metrics: [fields.mathTitle, fields.mathFormula, fields.heroBadge],
    summary: fields.mathFootnote,
    cta: fields.finalCtaLabel,
  };
}

function readStages(map: Y.Map<unknown>): StreamStage[] {
  return STAGES.map((s) => ({
    id: s.id,
    label: s.label,
    done: map.get(`done:${s.id}`) === true,
  }));
}

export function TemplateEditorShell(props: { initialPrompt?: string; docId?: string }) {
  const ydocRef = useRef<Y.Doc | null>(null);
  const metaMapRef = useRef<Y.Map<unknown> | null>(null);
  const fieldsMapRef = useRef<Y.Map<unknown> | null>(null);
  const streamMapRef = useRef<Y.Map<unknown> | null>(null);
  const composeAbortRef = useRef<AbortController | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [, setStatusText] = useState('Ready');
  const [templateId, setTemplateId] = useState('landing.v1');
  const [templateStatus, setTemplateStatus] = useState('idle');
  const [patchCount, setPatchCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [sharedPrompt, setSharedPrompt] = useState(props.initialPrompt ?? '');
  const [data, setData] = useState<PreviewData>(() => createStreamingSeed(props.initialPrompt ?? ''));
  const [stages, setStages] = useState<StreamStage[]>(() =>
    STAGES.map((s) => ({ id: s.id, label: s.label, done: false })),
  );
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [, setOverflowWarnings] = useState<string[]>([]);
  const [pageScale, setPageScale] = useState(1);
  const displayPrompt = sharedPrompt.trim().length > 0 ? sharedPrompt : 'default prompt';

  const applyValidatedPatch = (opts: {
    patch: TemplatePatch;
    opId: string;
    stageId?: (typeof STAGES)[number]['id'];
    status?: string;
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
    const defaultMeta = createDefaultTemplateMeta();
    const defaultFields = createDefaultTemplateFields();

    ydoc.transact(() => {
      metaMap.set('runId', runId);
      metaMap.set('templateId', defaultMeta.templateId);
      metaMap.set('theme', defaultMeta.theme);
      metaMap.set('version', defaultMeta.version);
      metaMap.set('status', 'streaming');
      metaMap.set('statusText', 'Streaming compose-template response...');
      metaMap.set('patchCount', 0);
      metaMap.set('prompt', promptValue);
      const defaultFieldEntries = Object.entries(defaultFields) as Array<[string, unknown]>;
      defaultFieldEntries.forEach(([k, v]) => fieldsMap.set(k, v));
      STAGES.forEach((stage) => streamMap.set(`done:${stage.id}`, false));
    });

    void streamTemplateCompose({
      apiBaseUrl: 'http://localhost:4000',
      signal: abortController.signal,
      req: {
        prompt: promptValue,
        templateCandidates: ['landing.v1'],
        themeHint: 'landing-dark',
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
          applyValidatedPatch({
            opId: event.opId,
            stageId: 'field_patch',
            status: 'Applied field_patch',
            patch: {
              opId: event.opId,
              stage: 'steps',
              fields: event.fields,
            },
          });
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

  useEffect(() => {
    const safeDocId =
      props.docId && props.docId.trim().length > 0 ? props.docId.trim() : 'template-default';
    const roomName = `yjs?doc=${safeDocId}`;
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider('ws://localhost:4000', roomName, ydoc, { connect: true });
    ydocRef.current = ydoc;

    const metaMap = ydoc.getMap<unknown>('templateMeta');
    const fieldsMap = ydoc.getMap<unknown>('templateFields');
    const streamMap = ydoc.getMap<unknown>('templateStream');
    metaMapRef.current = metaMap;
    fieldsMapRef.current = fieldsMap;
    streamMapRef.current = streamMap;

    const syncLocalFromMaps = () => {
      const promptValue =
        typeof metaMap.get('prompt') === 'string' ? (metaMap.get('prompt') as string) : '';
      const normalizedMeta = readTemplateMetaFromMap(cloneYMap(metaMap));
      const normalizedFields = readTemplateFieldsFromMap(cloneYMap(fieldsMap));
      const diagnostics = renderTemplateWithDiagnostics(
        LANDING_TEMPLATE_V1,
        normalizedFields,
      ).diagnostics;
      setSharedPrompt(promptValue);
      setData(toPreviewData(normalizedFields));
      setStages(readStages(streamMap));
      setTemplateId(normalizedMeta.templateId);
      setTemplateStatus(normalizedMeta.status);
      setPatchCount(
        typeof metaMap.get('patchCount') === 'number'
          ? (metaMap.get('patchCount') as number)
          : 0,
      );
      setMissingFields(diagnostics.missingFields);
      setOverflowWarnings(diagnostics.overflowWarnings);
      setStatusText(
        typeof metaMap.get('statusText') === 'string'
          ? (metaMap.get('statusText') as string)
          : 'Ready',
      );
    };

    ydoc.transact(() => {
      if (metaMap.get('initialized') !== true) {
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
      }
    });

    const onMeta = () => syncLocalFromMaps();
    const onFields = () => syncLocalFromMaps();
    const onStream = () => syncLocalFromMaps();
    metaMap.observe(onMeta as (evt: unknown) => void);
    fieldsMap.observe(onFields as (evt: unknown) => void);
    streamMap.observe(onStream as (evt: unknown) => void);
    syncLocalFromMaps();

    provider.on('status', (event: { status: string }) => {
      setIsConnected(event.status === 'connected');
    });

    provider.on('sync', (isSynced: boolean) => {
      if (!isSynced) return;
      const status = metaMap.get('status');
      if (status !== 'streaming' && status !== 'complete') {
        startComposeStream();
      }
    });

    return () => {
      composeAbortRef.current?.abort();
      metaMap.unobserve(onMeta as (evt: unknown) => void);
      fieldsMap.unobserve(onFields as (evt: unknown) => void);
      streamMap.unobserve(onStream as (evt: unknown) => void);
      provider.destroy();
      ydoc.destroy();
      ydocRef.current = null;
      metaMapRef.current = null;
      fieldsMapRef.current = null;
      streamMapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.docId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const H_PADDING = 56;
    const V_PADDING = 56;
    const FIT_SAFETY = 0.98;

    const updatePageScale = () => {
      const rect = el.getBoundingClientRect();
      const availW = Math.max(0, rect.width - H_PADDING);
      const availH = Math.max(0, rect.height - V_PADDING);
      if (availW <= 0 || availH <= 0) return;

      const scaleByWidth = availW / A4_BASE_WIDTH;
      const scaleByHeight = availH / A4_BASE_HEIGHT;
      const nextScale = Math.max(
        0.25,
        Math.min(scaleByWidth, scaleByHeight, 1) * FIT_SAFETY,
      );
      setPageScale(nextScale);
    };

    updatePageScale();
    const ro = new ResizeObserver(updatePageScale);
    ro.observe(el);
    window.addEventListener('resize', updatePageScale);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updatePageScale);
    };
  }, []);

  return (
    <div className={styles.editor}>
      <header className={styles.topbar}>
        <div className={styles.titleWrap}>
          <div className={styles.title}>Template Editor (Single Page)</div>
          <div className={styles.sub}>Prompt: {displayPrompt}</div>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={regenerate}>
            Regenerate composition
          </button>
        </div>
      </header>
      <div className={styles.workbench}>
        <main className={styles.stage}>
          <div ref={viewportRef} className={styles.pageViewport}>
            <div className={styles.pageViewportInner}>
              <div
                className={styles.pageScaleWrap}
                style={{
                  width: `${Math.ceil(A4_BASE_WIDTH * pageScale)}px`,
                  height: `${Math.ceil(A4_BASE_HEIGHT * pageScale)}px`,
                }}
              >
                <div
                  className={styles.pageScaleInner}
                  style={{
                    width: `${A4_BASE_WIDTH}px`,
                    height: `${A4_BASE_HEIGHT}px`,
                    transform: `scale(${pageScale})`,
                  }}
                >
                  <article className={styles.page}>
                    <header className={styles.pageHeader}>
                      <div className={styles.brand}>{data.brand}</div>
                      <div className={styles.docMeta}>Concept 1</div>
                    </header>

                    <h1 className={styles.heroTitle}>{data.title}</h1>
                    <p className={styles.heroSubtitle}>{data.subtitle}</p>

                    <section className={styles.twoCol}>
                      <div className={styles.panel}>
                        <h2>The Challenge</h2>
                        <ul>
                          {data.challenge.map((item, idx) => (
                            <li key={`challenge-${idx}-${item}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div className={styles.panel}>
                        <h2>Service Solution</h2>
                        <ul>
                          {data.service.map((item, idx) => (
                            <li key={`service-${idx}-${item}`}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </section>

                    <section className={styles.diagram}>
                      <div className={styles.diagramBox}>Architecture Diagram Placeholder</div>
                    </section>

                    <section className={styles.metricsRow}>
                      {data.metrics.map((metric, idx) => (
                        <div className={styles.metric} key={`metric-${idx}-${metric}`}>
                          {metric}
                        </div>
                      ))}
                    </section>

                    <section className={styles.summary}>{data.summary}</section>

                    <footer className={styles.footer}>
                      <div className={styles.footerTitle}>
                        Ready to unlock your retail media data potential?
                      </div>
                      <button type="button" className={styles.primaryCta}>
                        {data.cta}
                      </button>
                    </footer>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </main>
        <aside className={styles.sidebar}>
          <div className={styles.kv}>
            <span>Template</span>
            <strong>{templateId}</strong>
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
