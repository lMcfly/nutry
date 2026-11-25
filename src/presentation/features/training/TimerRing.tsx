import type { ReactNode } from 'react';
import styles from './TimerRing.module.css';

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface TimerRingProps {
  /** Part écoulée, de 0 à 1 (l'anneau se vide). */
  readonly remainingRatio: number;
  readonly children: ReactNode;
  readonly className?: string | undefined;
}

/** Anneau d'un minuteur : la part restante en couleur, le temps au centre. */
export function TimerRing({ remainingRatio, children, className }: TimerRingProps) {
  const ratio = Math.min(1, Math.max(0, remainingRatio));
  return (
    <div className={[styles.ring, className ?? ''].filter(Boolean).join(' ')}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className={styles.svg}>
        <circle className={styles.track} cx="50" cy="50" r={RADIUS} />
        <circle
          className={styles.value}
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE.toFixed(2)}
          strokeDashoffset={(CIRCUMFERENCE * (1 - ratio)).toFixed(2)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className={styles.center}>{children}</div>
    </div>
  );
}
