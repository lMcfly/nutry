import { useCallback, useEffect, useId, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';
import styles from './Sheet.module.css';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Fenêtres ouvertes, la plus récente en dernier : seule la dernière réagit à Échap et à Tab. */
const openStack: symbol[] = [];

/** Distance (px) de glissement vers le bas qui ferme une feuille. */
const SWIPE_CLOSE_DISTANCE = 80;

interface SheetProps {
  readonly open: boolean;
  readonly title: ReactNode;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** `sheet` : feuille ancrée en bas ; `dialog` : boîte centrée ; `full` : plein écran. */
  readonly variant?: 'sheet' | 'dialog' | 'full' | undefined;
  /** Description lue à l'ouverture. */
  readonly description?: ReactNode;
  /** Libellé du bouton de fermeture ✕. */
  readonly closeLabel?: string;
  /** Pied de la fenêtre (actions). */
  readonly footer?: ReactNode;
  /** Élément à focaliser à l'ouverture (sinon le premier élément focalisable). */
  readonly initialFocusRef?: RefObject<HTMLElement | null>;
  /** Rôle ARIA : `alertdialog` pour une confirmation importante. */
  readonly role?: 'dialog' | 'alertdialog';
}

/**
 * Fenêtre modale accessible : focus piégé, Échap ferme, focus rendu à l'élément
 * d'origine, arrière-plan inerte. En variante `sheet`, un glissement vers le bas ferme.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  variant = 'sheet',
  description,
  closeLabel = 'Fermer',
  footer,
  initialFocusRef,
  role = 'dialog',
}: SheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const host = panel?.closest('[data-sheet-host]');
    // Arrière-plan inerte (lecteurs d'écran et clavier).
    const siblings = [...document.body.children].filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        el !== host &&
        !el.inert &&
        // Les annonces (toasts) doivent rester audibles.
        !el.hasAttribute('data-live-region'),
    );
    for (const el of siblings) el.inert = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const target =
      initialFocusRef?.current ?? panel?.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    target?.focus();

    const self = Symbol('sheet');
    openStack.push(self);

    const onKeyDown = (event: KeyboardEvent) => {
      // Fenêtres empilées (célébration sur une feuille…) : seule celle du dessus réagit.
      if (openStack.at(-1) !== self) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const focusables = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusables[0];
      const last = focusables.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openStack.splice(openStack.indexOf(self), 1);
      for (const el of siblings) el.inert = false;
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, initialFocusRef]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = event.clientY;
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    const panel = panelRef.current;
    if (start === null || !panel) return;
    const dy = Math.max(0, event.clientY - start);
    panel.style.transform = dy > 0 ? `translateY(${dy}px)` : '';
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (panelRef.current) panelRef.current.style.transform = '';
    if (start !== null && event.clientY - start > SWIPE_CLOSE_DISTANCE) onCloseRef.current();
  }, []);

  if (!open) return null;

  return createPortal(
    <div className={styles.host} data-sheet-host="">
      <div
        className={styles.backdrop}
        aria-hidden="true"
        onClick={() => {
          onClose();
        }}
      />
      <div
        ref={panelRef}
        className={`${styles.panel} ${styles[variant]}`}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description !== undefined ? descriptionId : undefined}
        tabIndex={-1}
      >
        {variant === 'sheet' && (
          <div
            className={styles.handleArea}
            aria-hidden="true"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            data-testid="sheet-handle"
          >
            <span className={styles.handle} />
          </div>
        )}
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label={closeLabel}
            onClick={() => {
              onClose();
            }}
          >
            <CloseIcon size={20} />
          </button>
        </div>
        {description !== undefined && (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}
        <div className={styles.body}>{children}</div>
        {footer !== undefined && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
