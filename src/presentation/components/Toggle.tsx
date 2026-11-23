import { useId } from 'react';
import type { ReactNode } from 'react';
import styles from './Toggle.module.css';

interface ToggleProps {
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}

/** Interrupteur : case à cocher native exposée comme `switch`. */
export function Toggle({ label, hint, checked, onChange, disabled }: ToggleProps) {
  const hintId = useId();
  return (
    <label className={styles.toggle}>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint !== undefined && (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        aria-describedby={hint !== undefined ? hintId : undefined}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </label>
  );
}
