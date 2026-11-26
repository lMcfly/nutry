/**
 * Planche de démonstration (page de développement `mannequins.html`) : toutes les poses de
 * départ et d'arrivée en grille, ou une séquence d'images interpolées d'un mouvement.
 *
 * Paramètres : `?body=female|male`, `keys=squat,pompe`, `seq=squat` (séquence), `frames=4`,
 * `theme=dark`, `ex=id1,id2` ou `ex=all` (un mannequin par exercice du catalogue, avec son
 * matériel réel ; le script `planche.ts` injecte le catalogue dans `window.__EXERCISES__`).
 */

interface CatalogueEntry {
  readonly id: string;
  readonly name: string;
  readonly movement: string;
  readonly equipment: readonly Equipment[];
}
declare global {
  interface Window {
    __EXERCISES__?: readonly CatalogueEntry[];
  }
}
import { Fragment } from 'react';
import type { Equipment } from '@domain/training';
import { BODIES } from './body';
import type { BodyId } from './body';
import { FigureSvg } from './FigureSvg';
import { figureOf } from './exerciseFigure';
import type { FigureSpec } from './exerciseFigure';
import { distinctMovementKeys, resolveMovement } from './library';
import { movementViewBox, skeletonFor } from './model';
import type { ViewBox } from './model';
import type { MovementDef } from './library';
import type { Pose } from './rig';
import { cycleDuration, sampleTimeline } from './timeline';
import styles from './Planche.module.css';

interface CellProps {
  readonly movementKey: string;
  /** Exercice du catalogue : matériel et montage réels. */
  readonly entry?: CatalogueEntry | undefined;
  readonly body: BodyId;
  readonly size: number;
  readonly focus: string | null;
}

/** Cadre resserré autour des mains (gros plan de vérification des prises). */
function handsBox(def: MovementDef, pose: Pose, body: BodyId): ViewBox {
  const sk = skeletonFor(def, pose, body);
  const c = {
    x: (sk.joints.handL.x + sk.joints.handR.x) / 2,
    y: (sk.joints.handL.y + sk.joints.handR.y) / 2,
  };
  const w = Math.max(56, Math.abs(sk.joints.handL.x - sk.joints.handR.x) + 30);
  const h = w * 0.75;
  return { x: c.x - w / 2, y: -c.y - h / 2, width: w, height: h };
}

function Cell({ movementKey, entry, body, size, focus }: CellProps) {
  const spec: FigureSpec | undefined = entry ? figureOf(entry) : undefined;
  const def = resolveMovement(
    movementKey,
    spec ? { ...spec.variant, equipment: spec.equipment } : {},
  );
  if (!def) return null;
  const full = movementViewBox(def, body);
  const keys = def.timeline.keys.map((k) => k.pose);
  const shown = keys.length > 3 ? keys.slice(0, 4) : keys;
  return (
    <figure className={styles.cell}>
      <div className={styles.frames}>
        {shown.map((pose, i) => (
          <Fragment key={i}>
            {i > 0 && <span className={styles.arrow}>→</span>}
            <FigureSvg
              def={def}
              pose={pose}
              options={{ body, guides: focus === null }}
              box={focus === 'hands' ? handsBox(def, pose, body) : full}
              width={shown.length > 2 ? size * 0.75 : size}
            />
          </Fragment>
        ))}
      </div>
      <figcaption className={styles.caption}>
        <strong>{entry ? entry.name : def.label}</strong>{' '}
        <span>
          {entry
            ? `${entry.id} · ${figureOf(entry).equipment.join('+') || 'sans matériel'}`
            : def.key}
        </span>
      </figcaption>
    </figure>
  );
}

function Sequence({
  movementKey,
  body,
  frames,
}: {
  movementKey: string;
  body: BodyId;
  frames: number;
}) {
  const def = resolveMovement(movementKey);
  if (!def) return null;
  const box = movementViewBox(def, body);
  const timeline = def.timeline;
  const firstHold = timeline.keys[0]?.hold ?? 0;
  const firstMove =
    typeof timeline.moveMs === 'number' ? timeline.moveMs : (timeline.moveMs[0] ?? 1000);
  const total = cycleDuration(timeline);
  const times = Array.from({ length: frames }, (_, i) =>
    timeline.keys.length > 2 ? (total * i) / frames : firstHold + (firstMove * i) / (frames - 1),
  );
  return (
    <div className={styles.sequence}>
      <h1 className={styles.title}>
        {def.label} <span>— {frames} images interpolées</span>
      </h1>
      <div className={styles.frames}>
        {times.map((ms) => (
          <figure key={ms} className={styles.seqFrame}>
            <FigureSvg
              def={def}
              pose={sampleTimeline(timeline, ms, def.view, BODIES[body].frame)}
              options={{ body, guides: true }}
              box={box}
              width={260}
            />
            <figcaption className={styles.caption}>{Math.round(ms)} ms</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export function Planche({ query }: { query: string }) {
  const params = new URLSearchParams(query);
  const body: BodyId = params.get('body') === 'male' ? 'male' : 'female';
  if (params.get('theme') === 'dark') document.documentElement.dataset['theme'] = 'dark';
  const seq = params.get('seq');
  if (seq) {
    return (
      <main id="planche" className={styles.page}>
        <Sequence movementKey={seq} body={body} frames={Number(params.get('frames') ?? 4)} />
      </main>
    );
  }
  const ex = params.get('ex');
  if (ex) {
    const all = window.__EXERCISES__ ?? [];
    const wanted = ex === 'all' ? all : all.filter((e) => ex.split(',').includes(e.id));
    const from = Number(params.get('from') ?? 0);
    const count = Number(params.get('count') ?? wanted.length);
    const shown = wanted.slice(from, from + count);
    const size = Number(params.get('w') ?? 200);
    const cols = Number(params.get('cols') ?? 4);
    return (
      <main id="planche" className={styles.page}>
        <h1 className={styles.title}>
          Exercices Nutry <span>— {shown.length} exercices avec leur matériel</span>
        </h1>
        <div className={`${styles.grid} ${styles[`cols${cols}`] ?? ''}`}>
          {shown.map((entry) => (
            <Cell
              key={entry.id}
              movementKey={entry.movement}
              entry={entry}
              body={body}
              size={size}
              focus={params.get('focus')}
            />
          ))}
        </div>
      </main>
    );
  }
  const keys = params.get('keys')?.split(',') ?? distinctMovementKeys();
  const size = Number(params.get('w') ?? 200);
  const cols = Number(params.get('cols') ?? 4);
  return (
    <main id="planche" className={styles.page}>
      <h1 className={styles.title}>
        Mannequins Nutry{' '}
        <span>
          — {keys.length} mouvements, corps {body === 'male' ? 'homme' : 'femme'}
        </span>
      </h1>
      <div className={`${styles.grid} ${styles[`cols${cols}`] ?? ''}`}>
        {keys.map((key) => (
          <Cell key={key} movementKey={key} body={body} size={size} focus={params.get('focus')} />
        ))}
      </div>
    </main>
  );
}
