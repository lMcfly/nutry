import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import styles from './Swipeable.module.css';

export type SwipeDirection = 'prev' | 'next';

/** Distance horizontale minimale (px) d'un glissement volontaire. */
export const SWIPE_DISTANCE = 48;

interface SwipeableProps {
  readonly onSwipe: (direction: SwipeDirection) => void;
  readonly children: ReactNode;
  readonly className?: string | undefined;
  /** Change à chaque élément affiché : relance l'animation d'entrée. */
  readonly itemKey?: string | undefined;
  /** Sens du dernier changement (pour l'animation d'entrée). */
  readonly direction?: SwipeDirection | undefined;
}

/**
 * Glissement horizontal (pointer events, sans bibliothèque) : à gauche = suivant, à droite =
 * précédent. Le défilement vertical reste libre (`touch-action: pan-y`). Il est TOUJOURS
 * doublé de boutons équivalents fournis par l'appelant (clavier, lecteurs d'écran).
 */
export function Swipeable({
  onSwipe,
  children,
  className,
  itemKey,
  direction = 'next',
}: SwipeableProps) {
  const cleanup = useRef<(() => void) | undefined>(undefined);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(
    () => () => {
      cleanup.current?.();
    },
    [],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    cleanup.current?.();
    const finish = (up: PointerEvent) => {
      cleanup.current?.();
      const dx = up.clientX - startX;
      const dy = up.clientY - startY;
      if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy) * 1.5) {
        onSwipeRef.current(dx < 0 ? 'next' : 'prev');
      }
    };
    const cancel = () => {
      cleanup.current?.();
    };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    cleanup.current = () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      cleanup.current = undefined;
    };
  };

  return (
    <div
      key={itemKey}
      className={[
        styles.swipeable,
        direction === 'next' ? styles.fromRight : styles.fromLeft,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      onPointerDown={onPointerDown}
      data-testid="swipeable"
    >
      {children}
    </div>
  );
}
