import { useId } from 'react';
import styles from './MiniStepper.module.css';

interface MiniStepperProps {
  /** Nom du réglage (« Répétitions »), lu avec la valeur. */
  readonly label: string;
  readonly value: number;
  readonly step: number;
  readonly min: number;
  readonly max: number;
  /** Valeur affichée (« 12 », « 7,5 kg »). */
  readonly display: string;
  readonly unit?: string;
  readonly onChange: (value: number) => void;
  readonly disabled?: boolean;
}

/** Saisie rapide d'une série : − valeur +, boutons de 44 px, valeur annoncée. */
export function MiniStepper({
  label,
  value,
  step,
  min,
  max,
  display,
  unit,
  onChange,
  disabled,
}: MiniStepperProps) {
  const labelId = useId();
  const round = (v: number) => Math.round(v * 100) / 100;
  return (
    <div className={styles.stepper} role="group" aria-labelledby={labelId}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.button}
          aria-label={`Moins : ${label}`}
          disabled={disabled === true || value <= min}
          onClick={() => {
            onChange(Math.max(min, round(value - step)));
          }}
        >
          −
        </button>
        <output className={styles.value} aria-live="polite">
          {display}
          {unit !== undefined && <span className={styles.unit}> {unit}</span>}
        </output>
        <button
          type="button"
          className={styles.button}
          aria-label={`Plus : ${label}`}
          disabled={disabled === true || value >= max}
          onClick={() => {
            onChange(Math.min(max, round(value + step)));
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
