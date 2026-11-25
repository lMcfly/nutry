/** Aides à l'écriture des mouvements. */
import { FAR_OFFSET, solvePose } from '../rig';
import type { ContactPoint, Grip, JointName, LimbSide, Point, Pose, View } from '../rig';
import type { Keyframe, Loop } from '../timeline';
import type { MovementDef } from './types';

interface MoveSpec extends Omit<MovementDef, 'timeline'> {
  readonly keys: readonly (Pose | Keyframe)[];
  readonly loop?: Loop;
  /** Durée des transitions (ms). Une répétition dure en général 2 à 3 s. */
  readonly ms?: number | readonly number[];
  /** Pause sur la première et la dernière pose (ms). */
  readonly holds?: readonly [number, number];
  /** Prise par défaut des poses qui n'en déclarent pas. */
  readonly grip?: Grip | Partial<Record<LimbSide, Grip>>;
}

const isKeyframe = (k: Pose | Keyframe): k is Keyframe => 'pose' in k;

/** Rayon de chaque point d'appui possible (distance au support quand il est posé). */
const CONTACT_GAP: Readonly<Record<ContactPoint, number>> = {
  pelvis: 11,
  neck: 9.5,
  head: 10.5,
  heelL: 0,
  heelR: 0,
  toeL: 0,
  toeR: 0,
  kneeL: 5.2,
  kneeR: 5.2,
  handL: 3,
  handR: 3,
  elbowL: 4.4,
  elbowR: 4.4,
  ankleL: 4,
  ankleR: 4,
};

/**
 * Appuis d'une pose : ceux qu'elle déclare, sinon les points posés au sol (vue de profil ou de
 * face) et les mains ou chevilles amenées sur une cible (banc, mur, barre, plateforme).
 */
export function deriveContacts(p: Pose, view: View): ContactPoint[] {
  if (p.contacts) return [...p.contacts];
  const sk = solvePose(p, view);
  const out: ContactPoint[] = [];
  for (const [joint, gap] of Object.entries(CONTACT_GAP) as [ContactPoint, number][]) {
    if (joint === 'head') continue;
    const ground = view === 'profil' && joint.endsWith('R') ? FAR_OFFSET.y : 0;
    if (view !== 'dessus' && sk.joints[joint].y - gap <= ground + 1.5) out.push(joint);
  }
  for (const effector of Object.keys(p.reach ?? {}) as (
    'handL' | 'handR' | 'ankleL' | 'ankleR'
  )[]) {
    const joint: ContactPoint = effector.startsWith('ankle')
      ? (`heel${effector.slice(-1)}` as ContactPoint)
      : effector;
    if (!out.includes(joint) && !out.includes(`toe${effector.slice(-1)}` as ContactPoint)) {
      out.push(joint);
    }
  }
  // L'articulation ancrée est un appui (pied posé sur une marche, genou sur un coussin…).
  if ('joint' in p.anchor) {
    const j = p.anchor.joint;
    const anchored = (j.startsWith('ankle') ? `heel${j.slice(-1)}` : j) as ContactPoint;
    if (
      anchored in CONTACT_GAP &&
      anchored !== 'pelvis' &&
      anchored !== 'neck' &&
      !out.includes(anchored)
    ) {
      const toe = `toe${anchored.slice(-1)}` as ContactPoint;
      if (!(anchored.startsWith('heel') && out.includes(toe))) out.push(anchored);
    }
  }
  for (const side of ['L', 'R'] as const) {
    const hand: ContactPoint = `hand${side}`;
    if (p.grip?.[side] && p.grip[side] !== 'nuque' && !out.includes(hand)) out.push(hand);
  }
  // Pied à plat : talon et pointe ; on ne garde qu'une marque par pied.
  return out.filter(
    (c) => !(c.startsWith('toe') && out.includes(`heel${c.slice(-1)}` as ContactPoint)),
  );
}

export function move(spec: MoveSpec): MovementDef {
  const { keys, loop = 'aller-retour', ms = 1100, holds = [350, 250], grip, ...rest } = spec;
  const defaultGrip = typeof grip === 'string' ? { L: grip, R: grip } : grip;
  const last = keys.length - 1;
  return {
    ...rest,
    timeline: {
      loop,
      moveMs: ms,
      keys: keys.map((k, i) => {
        const frame = isKeyframe(k) ? k : { pose: k };
        const withGrip =
          frame.pose.grip || !defaultGrip ? frame.pose : { ...frame.pose, grip: defaultGrip };
        const p = { ...withGrip, contacts: deriveContacts(withGrip, rest.view) };
        if (isKeyframe(k)) return { ...k, pose: p };
        const hold = i === 0 ? holds[0] : i === last ? holds[1] : 0;
        return hold > 0 ? { pose: p, hold } : { pose: p };
      }),
    },
  };
}

/** Position d'une articulation pour une pose (pour caler une cible ou un décor). */
export function jointOf(p: Pose, joint: JointName, view: View = 'profil'): Point {
  return solvePose(p, view).joints[joint];
}
