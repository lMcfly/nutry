import { useCallback, useEffect, useId, useRef } from 'react';
import type { ChangeEvent, MouseEvent, PointerEvent } from 'react';
import styles from './NumberDial.module.css';

interface NumberDialProps {
  /** Nom du champ (lu par les lecteurs d'écran ; visible en version compacte). */
  readonly label: string;
  /** Texte saisi : il reste du texte tant qu'on tape (« 1,7 » n'est pas encore un nombre). */
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly min: number;
  readonly max: number;
  readonly step?: number;
  /** Valeur de départ quand le champ est vide et qu'on touche + ou − ou le curseur. */
  readonly start: number;
  /** Unité affichée à côté du chiffre (« ans », « cm »). */
  readonly unit: string;
  readonly decimal?: boolean;
  readonly error?: string | undefined;
  readonly hint?: string;
  /** Version en liste (écrans d'édition) : plus petite, avec le nom visible. */
  readonly compact?: boolean;
  readonly decrementLabel?: string;
  readonly incrementLabel?: string;
  /** Sans curseur (petites plages comme le nombre de personnes). */
  readonly noSlider?: boolean;
}

const REPEAT_DELAY_MS = 420;
const REPEAT_EVERY_MS = 85;

function parse(raw: string): number | undefined {
  const text = raw.trim().replace(',', '.');
  if (text === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Grand chiffre central avec − / + (appui long : ça défile, et de plus en plus vite) et un
 * curseur. Le chiffre est un vrai champ : on touche dessus pour taper au clavier numérique.
 */
export function NumberDial({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  start,
  unit,
  decimal = false,
  error,
  hint,
  compact = false,
  decrementLabel,
  incrementLabel,
  noSlider = false,
}: NumberDialProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const current = parse(value);

  const format = useCallback(
    (n: number): string => (decimal ? String(round1(n)).replace('.', ',') : String(Math.round(n))),
    [decimal],
  );

  // Le dernier état connu, lu par le minuteur de l'appui long.
  const latest = useRef({ current, onChange, min, max, step, start, format });
  latest.current = { current, onChange, min, max, step, start, format };
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ticks = useRef(0);

  const bump = useCallback((direction: 1 | -1) => {
    const s = latest.current;
    if (s.current === undefined) {
      s.onChange(s.format(s.start));
      return;
    }
    // Après quelques répétitions, on accélère (5 pas à la fois).
    const factor = ticks.current > 8 ? 5 : 1;
    const next = Math.min(s.max, Math.max(s.min, s.current + direction * s.step * factor));
    s.onChange(s.format(next));
  }, []);

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    ticks.current = 0;
  }, []);
  useEffect(() => stop, [stop]);

  const startPress = (direction: 1 | -1) => (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    stop();
    bump(direction);
    const repeat = () => {
      ticks.current += 1;
      bump(direction);
      timer.current = setTimeout(repeat, REPEAT_EVERY_MS);
    };
    timer.current = setTimeout(repeat, REPEAT_DELAY_MS);
    window.addEventListener('pointerup', stop, { once: true });
    window.addEventListener('pointercancel', stop, { once: true });
  };

  // Clavier et lecteurs d'écran : un clic « sans pointeur » (detail 0) fait un seul pas.
  const keyboardPress = (direction: 1 | -1) => (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) bump(direction);
  };

  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ');
  const shown = current === undefined ? '' : value;
  const sliderValue = Math.min(max, Math.max(min, current ?? start));

  return (
    <div className={`${styles.dial} ${compact ? styles.compact : ''}`}>
      <label
        htmlFor={id}
        className={compact ? styles.label : 'visually-hidden'}
        data-testid="dial-label"
      >
        {label}
      </label>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.round}
          aria-label={decrementLabel ?? `Diminuer : ${label}`}
          disabled={current !== undefined && current <= min}
          onPointerDown={startPress(-1)}
          onClick={keyboardPress(-1)}
          onContextMenu={(event) => {
            event.preventDefault();
          }}
        >
          <span aria-hidden="true">−</span>
        </button>
        <div className={styles.number}>
          <input
            id={id}
            type="text"
            inputMode={decimal ? 'decimal' : 'numeric'}
            autoComplete="off"
            className={`${styles.input} ${error ? styles.invalid : ''}`}
            style={{ width: `${Math.max(2, (shown || String(start)).length) + 0.4}ch` }}
            placeholder={String(start)}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy || undefined}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChange(event.target.value);
            }}
            onFocus={(event) => {
              event.target.select();
            }}
          />
          <span className={styles.unit} aria-hidden="true">
            {unit}
          </span>
        </div>
        <button
          type="button"
          className={styles.round}
          aria-label={incrementLabel ?? `Augmenter : ${label}`}
          disabled={current !== undefined && current >= max}
          onPointerDown={startPress(1)}
          onClick={keyboardPress(1)}
          onContextMenu={(event) => {
            event.preventDefault();
          }}
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {!noSlider && (
        <input
          type="range"
          className={styles.slider}
          min={min}
          max={max}
          step={decimal ? step : 1}
          value={sliderValue}
          aria-label={`${label}, curseur`}
          aria-valuetext={`${format(sliderValue)} ${unit}`}
          style={
            { '--fill': `${((sliderValue - min) / (max - min)) * 100}%` } as React.CSSProperties
          }
          onChange={(event) => {
            onChange(format(Number(event.target.value)));
          }}
        />
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
