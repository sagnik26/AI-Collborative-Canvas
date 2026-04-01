import { useMemo, useState } from 'react';
import styles from './DesignPage.module.css';

type CreateTab =
  | 'Slides'
  | 'Social'
  | 'UI Design'
  ;

export function DesignPage() {
  const createTabs = useMemo<CreateTab[]>(
    () => ['UI Design', 'Slides', 'Social'],
    [],
  );

  const [activeCreateTab, setActiveCreateTab] = useState<CreateTab>('UI Design');
  const [prompt, setPrompt] = useState(
    'Design a Facebook ad for a new course…',
  );

  const promptByTab = useMemo<Record<CreateTab, string>>(
    () => ({
      'UI Design': 'Build me a landing page for my coffee shop.',
      Slides: 'Create a 10-slide pitch deck for my coffee shop.',
      Social: 'Design a Facebook ad for my coffee shop.',
    }),
    [],
  );

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <header className={styles.hero}>
          <h1 className={styles.heroTitle}>What are we building today?</h1>
        </header>
        <section className={styles.creator} aria-label="Create">
          <div className={styles.creatorCard}>
            <div className={styles.tabsRow} role="tablist" aria-label="Formats">
              {createTabs.map((t) => {
                const isActive = t === activeCreateTab;
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
                    onClick={() => {
                      setActiveCreateTab(t);
                      setPrompt(promptByTab[t]);
                    }}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            <div className={styles.promptArea}>
              <label className={styles.promptLabel} htmlFor="design-prompt">
                <span className={styles.srOnly}>Prompt</span>
              </label>
              <textarea
                id="design-prompt"
                className={styles.textarea}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
            </div>

            <div className={styles.creatorBottomRow}>
              <div className={styles.bottomRowSpacer} />

              <button type="button" className={styles.primaryBtn}>
                Create
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
