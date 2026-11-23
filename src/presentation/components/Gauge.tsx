import styles from './Gauge.module.css';

interface GaugeProps {
  readonly label: string;
  readonly count: number;
  readonly target: number;
  readonly emoji?: string;
}

/** Jauge de variété : « 6 sur 10 », sans chiffre de calories. */
export function Gauge({ label, count, target, emoji }: GaugeProps) {
  const ratio = target > 0 ? Math.min(1, count / target) : 0;
  const reached = count >= target;
  return (
    <div className={styles.gauge}>
      <div className={styles.row}>
        <span className={styles.label}>
          {emoji !== undefined && <span aria-hidden="true">{emoji} </span>}
          {label}
        </span>
        <span className={styles.value} aria-hidden="true">
          {reached ? '✓ ' : ''}
          {count}/{target}
        </span>
      </div>
      <div
        className={styles.track}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(count, target)}
        aria-valuetext={`${count} sur ${target}${reached ? ', objectif atteint' : ''}`}
      >
        <div
          className={`${styles.fill} ${reached ? styles.reached : ''}`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}
