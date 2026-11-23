import type { ReactNode } from 'react';
import styles from './Gauge.module.css';

export type GaugeTone = 'default' | 'veg' | 'protein' | 'starch' | 'fish';

interface GaugeProps {
  readonly label: string;
  readonly count: number;
  readonly target: number;
  readonly emoji?: ReactNode;
  /** Couleur de la catégorie (légumes vert, protéines corail, féculents ambre, poisson bleu). */
  readonly tone?: GaugeTone;
  /** Texte visible à droite (sinon « count/target »). */
  readonly valueLabel?: string;
  /** Texte lu par les lecteurs d'écran (sinon « count sur target »). */
  readonly valueText?: string;
  /** Une seule ligne : libellé, jauge, valeur. */
  readonly inline?: boolean;
}

/** Jauge horizontale colorée, sans calories : « 6 sur 10 » ou une part d'assiette. */
export function Gauge({
  label,
  count,
  target,
  emoji,
  tone = 'default',
  valueLabel,
  valueText,
  inline = false,
}: GaugeProps) {
  const ratio = target > 0 ? Math.min(1, count / target) : 0;
  const reached = count >= target;
  const shown = valueLabel ?? `${count}/${target}`;
  return (
    <div className={`${styles.gauge} ${inline ? styles.inline : ''}`}>
      <span className={styles.label}>
        {emoji !== undefined && <span aria-hidden="true">{emoji} </span>}
        {label}
      </span>
      <div
        className={styles.track}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(count, target)}
        aria-valuetext={valueText ?? `${count} sur ${target}${reached ? ', objectif atteint' : ''}`}
      >
        <div
          className={`${styles.fill} ${styles[tone]}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <span className={styles.value} aria-hidden="true">
        {shown}
      </span>
    </div>
  );
}
