import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import styles from './TemplateEditorShell.module.css';
import type { TemplateFields, TemplateId, TemplatePatch, TemplateTheme } from '../types/template';
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
import { cloneYMap, hasText } from '../libs/template/yjsMapUtils.ts';
import { withTemplateFieldFallbacks } from '../libs/template/templateFieldFallbacks.ts';
import type { StreamStage, TemplateEditorShellProps } from '../types/templateEditor';
import { A4_BASE_HEIGHT, A4_BASE_WIDTH } from '../constants/templateEditor';
import { layoutClassForTemplateId, pageClassForTheme } from '../libs/template/templateEditorClasses.ts';
import { ComposeStreamTimeline } from './ComposeStreamTimeline.tsx';

// Constants and pure helpers live in `src/constants/**` and `src/libs/**`.

function createLoadingTemplateFields(): TemplateFields {
  return {
    heroBadge: 'Loading...',
    heroHeadline: 'Loading...',
    heroSubheadline: 'Loading...',
    heroPrimaryCta: 'Loading...',
    heroSecondaryCta: 'Loading...',
    socialProofTitle: 'Loading...',
    logos: ['Loading...', 'Loading...', 'Loading...', 'Loading...', 'Loading...', 'Loading...'],
    steps: [
      { title: 'Loading...', description: 'Loading...' },
      { title: 'Loading...', description: 'Loading...' },
      { title: 'Loading...', description: 'Loading...' },
    ],
    mathTitle: 'Loading...',
    mathFormula: 'Loading...',
    mathFootnote: 'Loading...',
    finalCtaHeadline: 'Loading...',
    finalCtaLabel: 'Loading...',
  };
}

export function TemplateEditorShell(props: TemplateEditorShellProps) {
  const templateCandidatesRef = useRef<TemplateId[]>(DEFAULT_TEMPLATE_CANDIDATES);
  templateCandidatesRef.current = props.templateCandidates ?? DEFAULT_TEMPLATE_CANDIDATES;

  const ydocRef = useRef<Y.Doc | null>(null);
  const metaMapRef = useRef<Y.Map<unknown> | null>(null);
  const fieldsMapRef = useRef<Y.Map<unknown> | null>(null);
  const streamMapRef = useRef<Y.Map<unknown> | null>(null);
  const composeAbortRef = useRef<AbortController | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [statusText, setStatusText] = useState('Ready');
  const [templateId, setTemplateId] = useState('landing.v1');
  const [templateTheme, setTemplateTheme] = useState<TemplateTheme>(() =>
    createDefaultTemplateMeta().theme,
  );
  const [templateStatus, setTemplateStatus] = useState('idle');
  const [sharedPrompt, setSharedPrompt] = useState(props.initialPrompt ?? '');
  const [fields, setFields] = useState<TemplateFields>(() => createDefaultTemplateFields());
  const [stages, setStages] = useState<StreamStage[]>(() =>
    STAGES.map((s) => ({ id: s.id, label: s.label, done: false })),
  );
  const [, setOverflowWarnings] = useState<string[]>([]);
  const [pageScale, setPageScale] = useState(1);
  const displayPrompt = sharedPrompt.trim().length > 0 ? sharedPrompt : 'default prompt';
  const isLoading = templateStatus === 'streaming';

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
    const loadingFields = createLoadingTemplateFields();

    ydoc.transact(() => {
      metaMap.set('runId', runId);
      metaMap.set('status', 'streaming');
      metaMap.set('statusText', 'Streaming compose-template response...');
      metaMap.set('patchCount', 0);
      metaMap.set('prompt', promptValue);
      const loadingFieldEntries = Object.entries(loadingFields) as Array<[string, unknown]>;
      loadingFieldEntries.forEach(([k, v]) => fieldsMap.set(k, v));
      clearStreamStageDones(streamMap);
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
      setFields(normalizedFields);
      setStages(readStages(streamMap));
      setTemplateId(normalizedMeta.templateId);
      setTemplateTheme(normalizedMeta.theme);
      setTemplateStatus(normalizedMeta.status);
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
        clearStreamStageDones(streamMap);
      }
    });

    const onMeta = () => syncLocalFromMaps();
    const onFields = () => syncLocalFromMaps();
    const onStream = () => syncLocalFromMaps();
    metaMap.observe(onMeta as (evt: unknown) => void);
    fieldsMap.observe(onFields as (evt: unknown) => void);
    streamMap.observe(onStream as (evt: unknown) => void);
    syncLocalFromMaps();

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
          <button
            type="button"
            className={styles.btn}
            onClick={regenerate}
            disabled={isLoading}
          >
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
                  <article
                    className={[
                      styles.page,
                      pageClassForTheme(templateTheme),
                      layoutClassForTemplateId(templateId),
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <header className={styles.pageHeader}>
                      <div className={styles.brand}>
                        {hasText(fields.heroBadge) ? fields.heroBadge : isLoading ? 'Loading...' : ''}
                      </div>
                      <div className={styles.docMeta}>{templateStatus}</div>
                    </header>

                    <h1 className={styles.heroTitle}>
                      {hasText(fields.heroHeadline)
                        ? fields.heroHeadline
                        : isLoading
                          ? 'Generating headline...'
                          : ''}
                    </h1>
                    <p className={styles.heroSubtitle}>
                      {hasText(fields.heroSubheadline)
                        ? fields.heroSubheadline
                        : isLoading
                          ? 'Generating subheadline...'
                          : ''}
                    </p>

                    <section className={styles.twoCol}>
                      <div className={styles.panel}>
                        <h2>Steps</h2>
                        {fields.steps.length > 0 ? (
                          <ul>
                            {fields.steps.map((step, idx) => (
                              <li key={`step-${idx}-${step.title}`}>
                                <strong>{step.title}: </strong>
                                {step.description}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className={styles.loadingHint}>
                            {isLoading ? 'Generating steps...' : ''}
                          </div>
                        )}
                      </div>
                      <div className={styles.panel}>
                        <h2>{hasText(fields.socialProofTitle) ? fields.socialProofTitle : 'Social proof'}</h2>
                        {fields.logos.length > 0 ? (
                          <ul>
                            {fields.logos.map((logo, idx) => (
                              <li key={`logo-${idx}-${logo}`}>{logo}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className={styles.loadingHint}>
                            {isLoading ? 'Generating logos...' : ''}
                          </div>
                        )}
                      </div>
                    </section>

                    <section className={styles.diagram}>
                      <div className={styles.diagramBox}>
                        {hasText(fields.mathTitle)
                          ? fields.mathTitle
                          : isLoading
                            ? 'Generating callout...'
                            : ''}
                      </div>
                    </section>

                    <section className={styles.metricsRow}>
                      <div className={styles.metric}>
                        {hasText(fields.mathFormula) ? fields.mathFormula : isLoading ? '...' : ''}
                      </div>
                      <div className={styles.metric}>
                        {hasText(fields.heroPrimaryCta) ? fields.heroPrimaryCta : isLoading ? '...' : ''}
                      </div>
                      <div className={styles.metric}>
                        {hasText(fields.heroSecondaryCta) ? fields.heroSecondaryCta : isLoading ? '...' : ''}
                      </div>
                      <div className={styles.metric}>
                        {hasText(fields.finalCtaLabel) ? fields.finalCtaLabel : isLoading ? '...' : ''}
                      </div>
                    </section>

                    <section className={styles.summary}>
                      {hasText(fields.mathFootnote) ? fields.mathFootnote : isLoading ? 'Generating summary...' : ''}
                    </section>

                    <footer className={styles.footer}>
                      <div className={styles.footerTitle}>
                        {hasText(fields.finalCtaHeadline)
                          ? fields.finalCtaHeadline
                          : isLoading
                            ? 'Generating final CTA...'
                            : ''}
                      </div>
                      <button
                        type="button"
                        className={styles.primaryCta}
                        disabled={!hasText(fields.finalCtaLabel)}
                      >
                        {hasText(fields.finalCtaLabel)
                          ? fields.finalCtaLabel
                          : isLoading
                            ? 'Loading...'
                            : ''}
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
          <ComposeStreamTimeline
            stages={stages}
            streaming={isLoading}
            composeFailed={templateStatus === 'error'}
            statusText={statusText}
          />
        </aside>
      </div>
    </div>
  );
}
