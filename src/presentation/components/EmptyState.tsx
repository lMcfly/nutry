import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  readonly emoji: string;
  readonly title: string;
  readonly children?: ReactNode;
  readonly action?: ReactNode;
  /** Niveau du titre (h2 par défaut). */
  readonly level?: 2 | 3;
}

export function EmptyState({ emoji, title, children, action, level = 2 }: EmptyStateProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className={styles.empty}>
      <span className={styles.emoji} aria-hidden="true">
        {emoji}
      </span>
      <Heading className={styles.title}>{title}</Heading>
      {children !== undefined && <div className={styles.text}>{children}</div>}
      {action !== undefined && <div className={styles.action}>{action}</div>}
    </div>
  );
}
