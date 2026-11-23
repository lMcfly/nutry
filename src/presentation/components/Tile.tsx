import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './Tile.module.css';

interface TileProps {
  readonly emoji: string;
  readonly title: string;
  /** Précision courte sous le titre. */
  readonly hint?: ReactNode;
  readonly onClick?: () => void;
  /** Lien de navigation (sinon bouton). */
  readonly to?: string;
  readonly tone?: 'default' | 'veg' | 'protein' | 'starch';
  readonly className?: string | undefined;
  /** Nom accessible complet (sinon titre + précision). */
  readonly ariaLabel?: string;
}

/** Tuile tactile arrondie : picto, titre, précision. Ouvre une feuille ou une page. */
export function Tile({
  emoji,
  title,
  hint,
  onClick,
  to,
  tone = 'default',
  className,
  ariaLabel,
}: TileProps) {
  const classes = [styles.tile, styles[tone], className ?? ''].filter(Boolean).join(' ');
  const content = (
    <>
      <span className={styles.emoji} aria-hidden="true">
        {emoji}
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {hint !== undefined && <span className={styles.hint}>{hint}</span>}
      </span>
    </>
  );
  if (to !== undefined) {
    return (
      <Link to={to} className={classes} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} aria-label={ariaLabel} onClick={onClick}>
      {content}
    </button>
  );
}
