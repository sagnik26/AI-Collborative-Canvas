import type { StreamStage } from '../types/templateEditor.ts';
import styles from './ComposeStreamTimeline.module.css';

type Props = {
  stages: StreamStage[];
  /** When true, the first incomplete stage shows a pulse and the progress bar may shimmer. */
  streaming: boolean;
  /** When true, the final stage shows `statusText` in red instead of “Finishing up”. */
  composeFailed: boolean;
  /** Error or status detail from template meta (e.g. API message); used when `composeFailed` is true. */
  statusText: string;
};

export function ComposeStreamTimeline({
  stages,
  streaming,
  composeFailed,
  statusText,
}: Props) {
  const doneCount = stages.filter((s) => s.done).length;
  const progressPct = stages.length ? (doneCount / stages.length) * 100 : 0;
  const activeIndex = stages.findIndex((s) => !s.done);
  const showShimmer = streaming && progressPct < 100 && !composeFailed;

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>Compose progress</h3>
      <div className={styles.timeline} role="list" aria-label="Compose stream stages">
        <div className={styles.track} aria-hidden>
          <div
            className={`${styles.trackFill} ${showShimmer ? styles.trackFillShimmer : ''}`}
            style={{ height: `${progressPct}%` }}
          />
        </div>
        <ul className={styles.nodes}>
          {stages.map((stage, i) => {
            const showErrorOnLast = composeFailed && stage.id === 'complete';
            const labelText = showErrorOnLast
              ? statusText.trim().length > 0
                ? statusText.trim()
                : 'Something went wrong'
              : stage.label;
            const isDone = stage.done && !showErrorOnLast;
            const isActive = streaming && activeIndex === i && !showErrorOnLast;
            return (
              <li key={stage.id} className={styles.row} role="listitem">
                <span
                  className={[
                    styles.dot,
                    showErrorOnLast ? styles.dotError : '',
                    isDone ? styles.dotDone : '',
                    isActive ? styles.dotPulse : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
                <span
                  className={[
                    styles.label,
                    showErrorOnLast ? styles.labelError : '',
                    isDone ? styles.labelDone : '',
                    isActive ? styles.labelActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {labelText}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
