import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TemplateId } from '../types/template';
import { createDocId } from '../libs/template/docId.ts';
import { DEFAULT_TEMPLATE_CANDIDATES } from '../libs/template/templatePacks.ts';
import { PROMPT_CHIPS } from '../constants/design';
import styles from './DesignShell.module.css';

export function DesignShell() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  /** Synced on chip click so Create always sees the latest allowlist (avoids stale state if Create is clicked right after a chip). */
  const composeCandidatesRef = useRef<TemplateId[] | undefined>(undefined);

  const hasPrompt = prompt.trim().length > 0;

  const goToEditor = () => {
    if (!hasPrompt) return;
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
              <ul className={styles.promptChips} aria-label="Start from a template">
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
                readOnly
                placeholder="Choose a starter above — your prompt will show here."
                title="Filled from starters above; not editable."
                rows={3}
              />
            </div>

            <div className={styles.creatorBottomRow}>
              <div className={styles.bottomRowSpacer} />

              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => goToEditor()}
                disabled={!hasPrompt}
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

