import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { makeIcon } from '../../../components/icons/Icon';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import type { BodyId } from './body';
import type { EquipmentKind } from './equipment';
import { FigureSvg } from './FigureSvg';
import { resolveMovement } from './library';
import type { Variant } from './library';
import { movementViewBox } from './model';
import { MUSCLE_LABELS } from './muscles';
import type { FigureMuscle } from './muscles';
import { sampleTimeline } from './timeline';
import { BODIES } from './body';
import styles from './ExerciseFigure.module.css';

export type FigureMode = 'animated' | 'start' | 'end' | 'steps';
export type FigureSize = 's' | 'm' | 'l' | number;

export interface ExerciseFigureProps {
  /** Clé de mouvement du catalogue (champ `movement` d'un exercice). */
  readonly movement: string;
  /** Matériel montré (celui du mouvement par défaut). */
  readonly equipment?: readonly EquipmentKind[] | undefined;
  /** Muscles surlignés (ceux du mouvement par défaut ; liste vide : aucun). */
  readonly highlight?: readonly FigureMuscle[] | undefined;
  readonly mode?: FigureMode | undefined;
  readonly size?: FigureSize | undefined;
  /** Morphologie du mannequin. */
  readonly body?: BodyId | undefined;
  /** Repères (trajectoire, dos droit) : affichés par défaut hors animation. */
  readonly guides?: boolean | undefined;
  /** Côté de travail, inclinaison du banc. */
  readonly variant?: Variant | undefined;
  readonly className?: string | undefined;
}

const PauseIcon = makeIcon(<path d="M9 6.5v11M15 6.5v11" />);
const PlayIcon = makeIcon(<path d="M8.5 6.2v11.6L18 12Z" />);
const ArrowIcon = makeIcon(<path d="M5 12h13m-4.5-4.5L18 12l-4.5 4.5" />);

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Joue la répétition en boucle tant que `playing` est vrai (requestAnimationFrame). */
function useClock(playing: boolean): number {
  const [time, setTime] = useState(0);
  const offset = useRef(0);
  useEffect(() => {
    if (!playing || typeof window.requestAnimationFrame !== 'function') return undefined;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      start ??= now - offset.current;
      offset.current = now - start;
      setTime(offset.current);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [playing]);
  return time;
}

/** Vrai tant que l'élément est à l'écran (l'animation s'arrête hors champ). */
function useVisible(ref: React.RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof window.IntersectionObserver !== 'function') return undefined;
    const observer = new window.IntersectionObserver((entries) => {
      setVisible(entries.some((entry) => entry.isIntersecting));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return visible;
}

/**
 * Mannequin qui montre un exercice : animé en boucle (avec bouton pause), pose de départ,
 * d'arrivée, ou toutes les étapes. Sans animation si l'utilisateur réduit les mouvements :
 * départ et arrivée côte à côte.
 */
export function ExerciseFigure({
  movement,
  equipment,
  highlight,
  mode = 'animated',
  size = 'm',
  body = 'female',
  variant,
  guides,
  className,
}: ExerciseFigureProps) {
  const reduced = useMediaQuery(REDUCED_MOTION);
  const rootRef = useRef<HTMLDivElement>(null);
  const visible = useVisible(rootRef);
  const [paused, setPaused] = useState(false);
  const def = useMemo(
    () => resolveMovement(movement, variant),
    // La variante est un petit objet : on la compare par valeur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [movement, variant?.side, variant?.incline],
  );
  const box = useMemo(() => (def ? movementViewBox(def, body) : null), [def, body]);
  const effective: FigureMode = mode === 'animated' && reduced ? 'steps' : mode;
  const animating = effective === 'animated' && !paused && visible;
  const time = useClock(animating);

  if (!def || !box) return null;
  const options = { body, highlight, equipment, guides: guides ?? effective !== 'animated' };
  const keys = def.timeline.keys.map((k) => k.pose);
  const endIndex = def.endIndex ?? keys.length - 1;
  const first = keys[0];
  const last = keys[endIndex] ?? first;
  if (!first || !last) return null;

  let frames;
  if (effective === 'animated') {
    frames = [sampleTimeline(def.timeline, time, def.view, BODIES[body].frame)];
  } else if (effective === 'start') {
    frames = [first];
  } else if (effective === 'end') {
    frames = [last];
  } else {
    // Étapes : départ → arrivée (et poses intermédiaires du mouvement complet hors réduction).
    frames = reduced && mode === 'animated' ? [first, last] : keys;
  }

  const muscles = (highlight ?? def.muscles).map((m) => MUSCLE_LABELS[m]);
  const label = [
    def.description,
    muscles.length > 0 ? `Muscles travaillés : ${muscles.join(', ')}.` : '',
    frames.length > 1 ? 'Étapes du mouvement de gauche à droite.' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const width =
    typeof size === 'number' ? size / (frames.length > 1 ? frames.length : 1) : undefined;
  const sizeClass = typeof size === 'number' ? '' : styles[size];

  return (
    <div
      ref={rootRef}
      className={[styles.root, sizeClass, frames.length > 1 ? styles.multi : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
      data-movement={def.key}
      data-mode={effective}
    >
      <div role="img" aria-label={label} className={styles.stage}>
        {frames.map((pose, i) => (
          <Fragment key={i}>
            {i > 0 && <ArrowIcon className={styles.arrow} />}
            <FigureSvg def={def} pose={pose} options={options} box={box} width={width} />
          </Fragment>
        ))}
      </div>
      {effective === 'animated' && (
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={paused}
          aria-label={`Mettre en pause l’animation : ${def.label}`}
          onClick={() => {
            setPaused((p) => !p);
          }}
        >
          {paused ? <PlayIcon size={20} /> : <PauseIcon size={20} />}
        </button>
      )}
    </div>
  );
}
