import { useId } from 'react';
import type { TrendPoint } from '@domain/progress';
import { formatDayShort, formatDecimal } from '../../i18n/labels';
import styles from './TrendChart.module.css';

interface TrendChartProps {
  readonly title: string;
  readonly unit: string;
  readonly points: readonly TrendPoint[];
  /** Mini-courbe d'une tuile : plus basse, sans légende. */
  readonly compact?: boolean;
}

const WIDTH = 320;
const HEIGHT = 160;
const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

/**
 * Courbe de tendance lissée en SVG inline, accessible : titre, description et
 * tableau des valeurs masqué visuellement.
 */
export function TrendChart({ title, unit, points, compact = false }: TrendChartProps) {
  const titleId = useId();
  const descId = useId();
  if (points.length === 0) return null;

  const values = points.flatMap((p) => [p.value, p.trend]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * innerH;
  const trendPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.trend).toFixed(1)}`)
    .join(' ');
  const first = points[0];
  const last = points.at(-1);
  const description =
    first && last
      ? `${points.length} mesure${points.length > 1 ? 's' : ''} du ${formatDayShort(first.date)} au ${formatDayShort(last.date)}. Tendance actuelle : ${formatDecimal(last.trend)} ${unit}.`
      : '';

  return (
    <figure className={`${styles.figure} ${compact ? styles.compact : ''}`}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={styles.svg}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <title id={titleId}>{title}</title>
        <desc id={descId}>{description}</desc>
        {[lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className={styles.grid}
            />
            <text x={PAD.left - 6} y={y(v) + 4} className={styles.axis} textAnchor="end">
              {formatDecimal(v, 0)}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.value)} r={3.5} className={styles.dot} />
        ))}
        <path d={trendPath} className={styles.trend} />
        {first && (
          <text x={x(0)} y={HEIGHT - 8} className={styles.axis} textAnchor="start">
            {formatDayShort(first.date)}
          </text>
        )}
        {last && points.length > 1 && (
          <text x={x(points.length - 1)} y={HEIGHT - 8} className={styles.axis} textAnchor="end">
            {formatDayShort(last.date)}
          </text>
        )}
      </svg>
      <figcaption className={styles.caption}>
        <span className={styles.legendTrend} aria-hidden="true" /> tendance lissée
        <span className={styles.legendDot} aria-hidden="true" /> mesures
      </figcaption>
      <table className="visually-hidden">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Mesure ({unit})</th>
            <th scope="col">Tendance ({unit})</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <td>{formatDayShort(p.date)}</td>
              <td>{formatDecimal(p.value)}</td>
              <td>{formatDecimal(p.trend)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
