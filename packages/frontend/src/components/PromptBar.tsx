import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './PromptBar.module.css';

export function PromptBar(props: {
  disabled?: boolean;
  statusText?: string;
  onSubmit: (instruction: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState('');
  const submittingRef = useRef(false);

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
    <div className={styles.bar}>
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
      >
        Layout
      </button>
      <div className={styles.hint}>
        {props.statusText ? <div>{props.statusText}</div> : null}
      </div>
    </div>
  );
}
