import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from './icons';
import styles from './ListRow.module.css';

interface ListGroupProps {
  readonly children: ReactNode;
  readonly label?: string;
  readonly className?: string | undefined;
}

/** Liste de réglages façon iOS : lignes séparées par un filet fin dans une seule surface. */
export function ListGroup({ children, label, className }: ListGroupProps) {
  return (
    <ul className={[styles.group, className ?? ''].filter(Boolean).join(' ')} aria-label={label}>
      {children}
    </ul>
  );
}

interface ListRowProps {
  /** Pictogramme au trait, décoratif. */
  readonly icon: ReactNode;
  readonly title: string;
  /** Précision courte à droite du titre (grise). */
  readonly hint?: ReactNode;
  readonly onClick?: () => void;
  /** Lien de navigation (sinon bouton). */
  readonly to?: string;
  /** Nom accessible complet (sinon titre + précision). */
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
  /** Pastille d'attention (point d'accent). */
  readonly dot?: boolean;
}

/** Ligne tactile : icône, libellé, précision, chevron. Ouvre une feuille ou une page. */
export function ListRow({
  icon,
  title,
  hint,
  onClick,
  to,
  ariaLabel,
  disabled,
  dot,
}: ListRowProps) {
  const content = (
    <>
      <span className={styles.icon}>
        {icon}
        {dot && <span className={styles.dot} />}
      </span>
      <span className={styles.title}>{title}</span>
      {hint !== undefined && <span className={styles.hint}>{hint}</span>}
      <span className={styles.chevron}>
        <ChevronRightIcon size={20} />
      </span>
    </>
  );
  return (
    <li className={styles.item}>
      {to !== undefined ? (
        <Link to={to} className={styles.row} aria-label={ariaLabel}>
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={styles.row}
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={onClick}
        >
          {content}
        </button>
      )}
    </li>
  );
}
