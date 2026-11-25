import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { TICK_PX, rulerIndexOfScroll, rulerValueAt } from './rulerMath';
import styles from './Ruler.module.css';

const isMultiple = (value: number, of: number): boolean =>
  Math.abs(value / of - Math.round(value / of)) < 1e-6;

interface RulerProps {
  /** Nom accessible de la règle. */
  readonly label: string;
  readonly min: number;
  readonly max: number;
  /** Écart entre deux graduations (1, ou 0,5 pour les kilos). */
  readonly unit: number;
  /** Valeur sous le repère (déjà bornée entre `min` et `max`). */
  readonly value: number;
  readonly valueText: string;
  readonly format: (n: number) => string;
  readonly onChange: (value: number) => void;
}

/**
 * Règle graduée horizontale : un conteneur à défilement natif avec accroche sur chaque
 * graduation (doigt, molette, inertie), un repère fixe au centre. La valeur est celle sous le
 * repère, calculée depuis `scrollLeft`. Au clavier, c'est un `slider` : ← → ↑ ↓ pas à pas,
 * PageUp et PageDown de 10, Début et Fin. Aucun défilement animé n'est déclenché par le code.
 */
export function Ruler({ label, min, max, unit, value, valueText, format, onChange }: RulerProps) {
  const scroller = useRef<HTMLDivElement>(null);
  /** Graduation que le code vient de viser : le prochain défilement n'est pas un geste. */
  const expected = useRef<number | undefined>(undefined);
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };
  const drag = useRef<{ x: number; left: number } | undefined>(undefined);

  const index = Math.round((value - min) / unit);
  const count = Math.round((max - min) / unit) + 1;

  // La valeur change ailleurs (saisie, − / +) : la règle suit, sauf si la main la fait défiler.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (rulerIndexOfScroll(el.scrollLeft, min, max, unit) === index) return;
    expected.current = index;
    el.scrollLeft = index * TICK_PX;
  }, [index, min, max, unit]);

  // Molette verticale (souris) : fait défiler la règle dans le sens de la graduation.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        el.scrollLeft += event.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const at = rulerIndexOfScroll(el.scrollLeft, min, max, unit);
    if (expected.current !== undefined) {
      if (expected.current === at) {
        expected.current = undefined;
        return;
      }
      expected.current = undefined;
    }
    const next = rulerValueAt(at, min, unit);
    if (next !== latest.current.value) latest.current.onChange(next);
  };

  const set = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (clamped !== value) onChange(clamped);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number | undefined> = {
      ArrowRight: value + unit,
      ArrowUp: value + unit,
      ArrowLeft: value - unit,
      ArrowDown: value - unit,
      PageUp: value + 10,
      PageDown: value - 10,
      Home: min,
      End: max,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    set(next);
  };

  // Souris : on peut aussi attraper la règle et la tirer (le doigt, lui, défile nativement).
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    if (event.pointerType !== 'mouse' || event.button !== 0 || !el) return;
    drag.current = { x: event.clientX, left: el.scrollLeft };
    el.setPointerCapture(event.pointerId);
    el.dataset['dragging'] = 'true';
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = scroller.current;
    const start = drag.current;
    if (!el || !start) return;
    el.scrollLeft = start.left - (event.clientX - start.x);
  };
  const endDrag = () => {
    const el = scroller.current;
    drag.current = undefined;
    if (el) delete el.dataset['dragging'];
  };

  const ticks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const v = rulerValueAt(i, min, unit);
        const kind = isMultiple(v, 10)
          ? 'label'
          : isMultiple(v, 5)
            ? 'major'
            : Number.isInteger(v)
              ? 'minor'
              : 'half';
        return { i, v, kind };
      }),
    [count, min, unit],
  );

  return (
    <div className={styles.wrap} style={{ '--tick': `${TICK_PX}px` } as CSSProperties}>
      <div
        ref={scroller}
        className={styles.scroller}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className={styles.track} aria-hidden="true">
          {ticks.map(({ i, v, kind }) => (
            <span key={i} className={`${styles.tick} ${styles[kind]}`}>
              {kind === 'label' && <span className={styles.number}>{format(v)}</span>}
            </span>
          ))}
        </div>
      </div>
      <span className={styles.marker} aria-hidden="true" />
    </div>
  );
}
