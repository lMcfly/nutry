import { useCallback, useEffect, useRef, useState } from 'react';

export type TimerEnd = 'done' | 'skipped';

export interface RestTimer {
  /** Durée totale (secondes), rallonges comprises. */
  readonly total: number;
  /** Temps restant (secondes, décimales comprises). */
  readonly remaining: number;
  readonly running: boolean;
  readonly start: (seconds: number) => void;
  /** Ajoute du temps (+15 s) au minuteur en cours. */
  readonly add: (seconds: number) => void;
  /** « Passer » : arrête le minuteur tout de suite. */
  readonly skip: () => void;
  /** Arrête sans rien annoncer (changement d'exercice). */
  readonly stop: () => void;
}

interface Options {
  readonly onEnd?: (reason: TimerEnd) => void;
  /** Horloge monotone en millisecondes (injectée par les tests). */
  readonly now?: () => number;
  readonly tickMs?: number;
}

const defaultNow = () => performance.now();

/**
 * Minuteur de repos calculé depuis l'instant de fin (et non en décomptant les secondes) : il
 * reste juste après une mise en veille ou un onglet en arrière-plan.
 */
export function useRestTimer({ onEnd, now = defaultNow, tickMs = 250 }: Options = {}): RestTimer {
  const [total, setTotal] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const nowRef = useRef(now);
  nowRef.current = now;

  useEffect(() => {
    if (!running) return undefined;
    const tick = () => {
      const left = (endAt.current - nowRef.current()) / 1000;
      if (left <= 0) {
        setRemaining(0);
        setRunning(false);
        onEndRef.current?.('done');
      } else {
        setRemaining(left);
      }
    };
    const id = setInterval(tick, tickMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [running, tickMs]);

  const start = useCallback((seconds: number) => {
    endAt.current = nowRef.current() + seconds * 1000;
    setTotal(seconds);
    setRemaining(seconds);
    setRunning(true);
  }, []);

  const add = useCallback((seconds: number) => {
    endAt.current += seconds * 1000;
    setTotal((t) => t + seconds);
    setRemaining((r) => r + seconds);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
    setRemaining(0);
  }, []);

  const skip = useCallback(() => {
    stop();
    onEndRef.current?.('skipped');
  }, [stop]);

  return { total, remaining, running, start, add, skip, stop };
}
