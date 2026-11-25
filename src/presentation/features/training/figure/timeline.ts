/**
 * Interpolation entre poses et lecture d'une répétition dans le temps (fonctions pures).
 */
import { ANGLE_KEYS, FOLD_KEYS, bakePose, lerp, lerpPoint, normalize, solvePose } from './rig';
import type { Anchor, Effector, FootMode, Frame, Pose, View } from './rig';

/** Accélération puis décélération douces (sinusoïde). */
export function easeInOut(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.min(Math.max(t, 0), 1));
}

/** Interpolation d'angle par le plus court chemin. */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + normalize(b - a) * t;
}

function lerpAnchor(a: Pose, b: Pose, t: number, view: View, frame: Frame): Anchor {
  const aa = a.anchor;
  const bb = b.anchor;
  if ('joint' in aa && 'joint' in bb && aa.joint === bb.joint) {
    return { joint: aa.joint, at: lerpPoint(aa.at, bb.at, t) };
  }
  if ('ground' in aa && 'ground' in bb) {
    return { ground: lerp(aa.ground, bb.ground, t), lift: lerp(aa.lift ?? 0, bb.lift ?? 0, t) };
  }
  // Ancres différentes : on interpole la position du bassin.
  const pa = solvePose(a, view, frame).joints.pelvis;
  const pb = solvePose(b, view, frame).joints.pelvis;
  return { joint: 'pelvis', at: lerpPoint(pa, pb, t) };
}

/**
 * Pose intermédiaire entre `a` et `b` (t ∈ [0, 1]) : angles résolus interpolés, ancre interpolée,
 * cibles communes interpolées puis résolues à nouveau (une main posée reste posée).
 */
export function interpolatePose(a: Pose, b: Pose, t: number, view: View, frame: Frame): Pose {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ba = bakePose(a, view, frame);
  const bb = bakePose(b, view, frame);
  const angles = { ...ba.angles };
  for (const key of ANGLE_KEYS) angles[key] = lerpAngle(ba.angles[key], bb.angles[key], t);

  const reach: Partial<Record<Effector, { x: number; y: number }>> = {};
  for (const key of ['handL', 'handR', 'ankleL', 'ankleR'] as const) {
    const ta = a.reach?.[key];
    const tb = b.reach?.[key];
    if (ta && tb) reach[key] = lerpPoint(ta, tb, t);
  }
  const feet: Partial<Record<'L' | 'R', FootMode>> = {};
  for (const side of ['L', 'R'] as const) {
    const fa = a.feet?.[side];
    if (fa !== undefined && fa === b.feet?.[side]) feet[side] = fa;
  }
  const fold: Partial<Record<(typeof FOLD_KEYS)[number], number>> = {};
  for (const key of FOLD_KEYS) {
    const fa = a.fold?.[key] ?? 1;
    const fb = b.fold?.[key] ?? 1;
    if (fa !== 1 || fb !== 1) fold[key] = lerp(fa, fb, t);
  }
  const bend = t < 0.5 ? a.bend : b.bend;
  const near = t < 0.5 ? a : b;
  return {
    ...(near.grip ? { grip: near.grip } : {}),
    ...(near.contacts ? { contacts: near.contacts } : {}),
    angles,
    anchor: lerpAnchor(a, b, t, view, frame),
    reach,
    feet,
    fold,
    ...(bend ? { bend } : {}),
  };
}

export interface Keyframe {
  readonly pose: Pose;
  /** Pause sur cette pose (ms). */
  readonly hold?: number;
}

export type Loop = 'aller-retour' | 'boucle';

export interface Timeline {
  readonly keys: readonly Keyframe[];
  readonly loop: Loop;
  /** Durée de chaque transition (ms) : une valeur ou une par transition. */
  readonly moveMs: number | readonly number[];
}

interface Step {
  readonly from: number;
  readonly to: number;
  readonly ms: number;
}

function steps(timeline: Timeline): Step[] {
  const n = timeline.keys.length;
  const order: number[] = [];
  if (timeline.loop === 'boucle') {
    for (let i = 0; i < n; i += 1) order.push(i);
  } else {
    for (let i = 0; i < n; i += 1) order.push(i);
    for (let i = n - 2; i > 0; i -= 1) order.push(i);
  }
  const out: Step[] = [];
  order.forEach((from, index) => {
    const to = order[(index + 1) % order.length] ?? 0;
    const hold = timeline.keys[from]?.hold ?? 0;
    if (hold > 0) out.push({ from, to: from, ms: hold });
    if (n > 1) {
      const move =
        typeof timeline.moveMs === 'number'
          ? timeline.moveMs
          : (timeline.moveMs[index % timeline.moveMs.length] ?? 800);
      out.push({ from, to, ms: move });
    }
  });
  return out;
}

/** Durée d'une répétition complète (ms). */
export function cycleDuration(timeline: Timeline): number {
  return steps(timeline).reduce((total, step) => total + step.ms, 0);
}

/** Pose à l'instant `ms` (la répétition boucle). */
export function sampleTimeline(timeline: Timeline, ms: number, view: View, frame: Frame): Pose {
  const all = steps(timeline);
  const total = cycleDuration(timeline);
  const first = timeline.keys[0];
  if (!first) throw new Error('Mouvement sans pose.');
  if (total <= 0) return first.pose;
  let time = ((ms % total) + total) % total;
  for (const step of all) {
    if (time <= step.ms) {
      const a = timeline.keys[step.from]?.pose ?? first.pose;
      const b = timeline.keys[step.to]?.pose ?? first.pose;
      return step.from === step.to
        ? a
        : interpolatePose(a, b, easeInOut(time / step.ms), view, frame);
    }
    time -= step.ms;
  }
  return first.pose;
}
