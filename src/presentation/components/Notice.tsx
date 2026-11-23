import type { ReactNode } from 'react';
import styles from './Notice.module.css';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger' | 'accent';

interface NoticeProps {
  readonly tone?: NoticeTone;
  readonly emoji?: string;
  readonly title?: ReactNode;
  readonly children?: ReactNode;
  /** Bouton de fermeture (✕) ; le libellé sert aux lecteurs d'écran. */
  readonly onDismiss?: () => void;
  readonly dismissLabel?: string;
  readonly action?: ReactNode;
  /** Annonce le message dès son apparition (role="status"). */
  readonly live?: boolean;
  readonly className?: string;
}

/** Message doux en encart : information, réussite, attention ou erreur. */
export function Notice({
  tone = 'info',
  emoji,
  title,
  children,
  onDismiss,
  dismissLabel = 'Masquer ce message',
  action,
  live,
  className,
}: NoticeProps) {
  return (
    <div
      className={`${styles.notice} ${styles[tone]} ${className ?? ''}`}
      role={live ? 'status' : undefined}
    >
      {emoji !== undefined && (
        <span className={styles.emoji} aria-hidden="true">
          {emoji}
        </span>
      )}
      <div className={styles.content}>
        {title !== undefined && <p className={styles.title}>{title}</p>}
        {children !== undefined && <div className={styles.text}>{children}</div>}
        {action !== undefined && <div className={styles.action}>{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          className={styles.dismiss}
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          ✕
        </button>
      )}
    </div>
  );
}
