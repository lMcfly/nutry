import type { ReactNode } from 'react';
import styles from './ScrollArea.module.css';

interface ScrollAreaProps {
  /** Nom de la zone, lu par les lecteurs d'écran. */
  readonly label: string;
  readonly children: ReactNode;
  readonly className?: string | undefined;
  /** `x` : défilement horizontal (puces) ; `y` par défaut. */
  readonly axis?: 'x' | 'y';
}

/**
 * Zone qui défile à l'intérieur de sa carte (les écrans, eux, ne défilent jamais).
 * Focalisable au clavier pour pouvoir la faire défiler sans souris.
 */
export function ScrollArea({ label, children, className, axis = 'y' }: ScrollAreaProps) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={[styles.scroll, axis === 'x' ? styles.x : styles.y, className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
