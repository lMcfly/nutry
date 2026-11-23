import { useId } from 'react';
import styles from './Stepper.module.css';

interface StepperProps {
  readonly label: string;
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly onChange: (value: number) => void;
  /** Texte lu avec la valeur, ex. (n) => `${n} personnes`. */
  readonly format?: (value: number) => string;
  readonly decrementLabel?: string;
  readonly incrementLabel?: string;
}

/** Compteur − / + (taille du foyer). */
export function Stepper({
  label,
  value,
  min = 1,
  max = 12,
  onChange,
  format = String,
  decrementLabel = 'Diminuer',
  incrementLabel = 'Augmenter',
}: StepperProps) {
  const labelId = useId();
  return (
    <div className={styles.stepper} role="group" aria-labelledby={labelId}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.button}
          aria-label={decrementLabel}
          disabled={value <= min}
          onClick={() => {
            onChange(Math.max(min, value - 1));
          }}
        >
          −
        </button>
        <output className={styles.value} aria-live="polite">
          {format(value)}
        </output>
        <button
          type="button"
          className={styles.button}
          aria-label={incrementLabel}
          disabled={value >= max}
          onClick={() => {
            onChange(Math.min(max, value + 1));
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
