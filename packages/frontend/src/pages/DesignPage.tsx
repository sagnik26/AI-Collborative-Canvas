import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TemplateId } from '../types/template';
import { DEFAULT_TEMPLATE_CANDIDATES } from '../libs/template/templatePacks.ts';
import styles from './DesignPage.module.css';

type PromptChip = {
  label: string;
  prompt: string;
  /** Passed to the template editor as compose allowlist when set. */
  templateCandidates?: TemplateId[];
};

const PROMPT_CHIPS: PromptChip[] = [
  {
    label: 'Landing page',
    prompt:
      'Build a full marketing landing page for a B2B analytics product: hero with badge and dual CTAs, social proof strip, three clear steps, a math-style proof block, and a closing CTA section.',
    templateCandidates: ['landing.v1'],
  },
  {
    label: 'Metrics pitch',
    prompt:
      'Create a metrics-first pitch layout for a fundraise: lead with KPIs and growth, tight copy, emphasize ROI and traction.',
    templateCandidates: ['pitch.v2'],
  },
  {
    label: 'Story pitch',
    prompt:
      'Draft a narrative pitch page for a climate startup: founder story on one side, proof and credibility on the other, warm but confident tone.',
    templateCandidates: ['pitch.v1'],
  },
  {
    label: 'Pitch deck',
    prompt:
      'Outline copy for a 10-slide deck: problem, solution, market, traction with KPIs, business model, team, and ask—headline-style lines per slide.',
    templateCandidates: ['pitch.v2', 'pitch.v1', 'pitch.v3'],
  },
  {
    label: 'Social post',
    prompt:
      'Write channel-ready promo copy: hook, three value bullets, and one CTA—works for LinkedIn, Instagram caption, or a short ad primary text.',
    /** Same allowlist as omitting candidates (explicit so chip click always resets a prior narrow list). */
    templateCandidates: [...DEFAULT_TEMPLATE_CANDIDATES],
  },
];

export function DesignPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  /** Synced on chip click so Create always sees the latest allowlist (avoids stale state if Create is clicked right after a chip). */
  const composeCandidatesRef = useRef<TemplateId[] | undefined>(undefined);

  const createDocId = () =>
    `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const goToEditor = () => {
    const docId = createDocId();
    const search = new URLSearchParams();
    search.set('doc', docId);
    const ids = composeCandidatesRef.current;
    const isFullAllowlist =
      ids != null &&
      ids.length === DEFAULT_TEMPLATE_CANDIDATES.length &&
      DEFAULT_TEMPLATE_CANDIDATES.every((id, i) => id === ids[i]);
    if (ids?.length && !isFullAllowlist) {
      search.set('candidates', ids.join(','));
    }
    navigate(`/design/editor?${search.toString()}`, {
      state: { prompt, docId },
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <header className={styles.hero}>
          <h1 className={styles.heroTitle}>What are we building today?</h1>
        </header>
        <section className={styles.creator} aria-label="Create">
          <div className={styles.creatorCard}>
            <div className={styles.promptArea}>
              <ul
                className={styles.promptChips}
                aria-label="Start from a template"
              >
                {PROMPT_CHIPS.map((chip) => (
                  <li key={chip.label}>
                    <button
                      type="button"
                      className={styles.chip}
                      onClick={() => {
                        setPrompt(chip.prompt);
                        composeCandidatesRef.current = chip.templateCandidates;
                      }}
                    >
                      {chip.label}
                    </button>
                  </li>
                ))}
              </ul>
              <label className={styles.promptLabel} htmlFor="design-prompt">
                <span className={styles.srOnly}>Prompt</span>
              </label>
              <textarea
                id="design-prompt"
                className={styles.textarea}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Or describe your own idea here, then Create."
                rows={3}
              />
            </div>

            <div className={styles.creatorBottomRow}>
              <div className={styles.bottomRowSpacer} />

              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => goToEditor()}
              >
                Create
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
