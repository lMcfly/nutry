import { describePlate } from '@domain/recipe';
import type { PlateBalance } from '@domain/recipe';
import styles from './PlateGauges.module.css';

const PLATE_PARTS: readonly {
  readonly key: keyof PlateBalance;
  readonly label: string;
  readonly emoji: string;
  readonly className: string;
}[] = [
  { key: 'vegetables', label: 'Légumes', emoji: '🥦', className: styles['veg'] ?? '' },
  { key: 'starches', label: 'Féculents', emoji: '🍚', className: styles['starch'] ?? '' },
  { key: 'proteins', label: 'Protéines', emoji: '🍗', className: styles['protein'] ?? '' },
];

const CENTER = 50;
const RADIUS = 38;

function point(angle: number): string {
  return `${(CENTER + RADIUS * Math.cos(angle)).toFixed(2)} ${(CENTER + RADIUS * Math.sin(angle)).toFixed(2)}`;
}

/** Secteur de disque entre deux angles (radians), ou disque plein si la part est entière. */
function wedge(from: number, to: number): string {
  const large = to - from > Math.PI ? 1 : 0;
  return `M${CENTER} ${CENTER} L${point(from)} A${RADIUS} ${RADIUS} 0 ${large} 1 ${point(to)} Z`;
}

/**
 * Assiette illustrée : un disque découpé en secteurs (légumes, féculents, protéines) d'après
 * `plateBalance`. Aucun pourcentage à l'écran : la légende donne un emoji et un mot, et la
 * part de chacun se lit en mots pour les lecteurs d'écran (« environ la moitié »).
 */
export function PlateGauges({ plate }: { readonly plate: PlateBalance }) {
  let angle = -Math.PI / 2;
  const total = plate.vegetables + plate.starches + plate.proteins || 1;
  const wedges = PLATE_PARTS.filter((part) => plate[part.key] > 0).map((part) => {
    const span = (plate[part.key] / total) * Math.PI * 2;
    const from = angle;
    angle += span;
    return { part, from, to: angle, whole: span > Math.PI * 2 - 0.001 };
  });
  return (
    <div className={styles.plate}>
      <svg
        className={styles.disc}
        viewBox="0 0 100 100"
        role="img"
        aria-label={`Composition de l’assiette : ${describePlate(plate)}`}
      >
        <circle cx={CENTER} cy={CENTER} r="48" className={styles.rim} />
        <circle cx={CENTER} cy={CENTER} r="43.5" className={styles.rimInner} />
        {wedges.map(({ part, from, to, whole }) =>
          whole ? (
            <circle key={part.key} cx={CENTER} cy={CENTER} r={RADIUS} className={part.className} />
          ) : (
            <path
              key={part.key}
              d={wedge(from, to)}
              className={`${part.className} ${styles.cut}`}
            />
          ),
        )}
      </svg>
      <ul className={styles.legend}>
        {PLATE_PARTS.map((part) => (
          <li key={part.key} className={styles.legendItem}>
            <span className={`${styles.dot} ${part.className}`} aria-hidden="true" />
            <span aria-hidden="true">{part.emoji}</span>
            {part.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
