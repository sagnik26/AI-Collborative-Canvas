import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './PromptBar.module.css';

export function PromptBar(props: {
  disabled?: boolean;
  statusText?: string;
  onSubmit: (instruction: string) => Promise<void> | void;
  variant?: 'toolbar' | 'chat';
  historyMessages?: Array<{
    id: string;
    text: string;
    status: 'pending' | 'done' | 'error';
  }>;
}) {
  const [value, setValue] = useState('');
  const submittingRef = useRef(false);
  const variant = props.variant ?? 'toolbar';

  const submit = useCallback(async () => {
    const v = value.trim();
    if (!v) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await props.onSubmit(v);
      setValue('');
    } finally {
      submittingRef.current = false;
    }
  }, [props, value]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      )
        return;
      e.preventDefault();
      void submit();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submit]);

  return (
    <div className={variant === 'chat' ? styles.chat : styles.bar}>
      {variant === 'chat' ? (
        <>
          {props.historyMessages && props.historyMessages.length > 0 ? (
            <div className={styles.messages} aria-label="Previous prompts">
              {props.historyMessages.slice(-5).map((m) => (
                <div
                  key={m.id}
                  className={`${styles.bubble} ${m.status === 'pending' ? styles.bubblePending : ''} ${m.status === 'error' ? styles.bubbleError : ''}`}
                >
                  <div className={styles.bubbleText}>{m.text}</div>
                  {m.status === 'pending' ? (
                    <div className={styles.bubbleLoader} aria-label="Loading">
                      <span className={styles.dots} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <div className={styles.chatComposer}>
            <div className={styles.composerBox}>
              <textarea
                className={styles.chatInput}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Message…"
                disabled={props.disabled}
                rows={4}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (e.shiftKey) return;
                  e.preventDefault();
                  void submit();
                }}
              />
              <button
                className={styles.chatSend}
                onClick={() => void submit()}
                disabled={props.disabled || value.trim().length === 0}
                aria-label="Send"
                type="button"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M4 12l16-8-6.2 16-2.6-6.2L4 12z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className={styles.hint}>
            {props.statusText ? <div>{props.statusText}</div> : null}
          </div>
        </>
      ) : (
        <>
          <input
            className={styles.input}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask AI to rearrange… e.g. “align left”, “make a 2x2 grid”, “space evenly”"
            disabled={props.disabled}
          />
          <button
            className={styles.btn}
            onClick={() => void submit()}
            disabled={props.disabled}
            type="button"
          >
            Layout
          </button>
          <div className={styles.hint}>
            {props.statusText ? <div>{props.statusText}</div> : null}
          </div>
        </>
      )}
    </div>
  );
}
