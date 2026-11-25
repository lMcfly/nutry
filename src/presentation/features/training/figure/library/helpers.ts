/** Positions de base réutilisées (debout, quatre pattes, allongé, assis) et petites géométries. */
import { solvePose } from '../rig';
import type { Point, Pose, View } from '../rig';
import { jointOf } from './build';
import { ANKLE_Y, KNEE_Y, PALM_Y, on, pose, pt } from './pose';
import type { PoseSpec } from './pose';
import { tune } from './tune';

export const FEET = on('ankleL', 0, ANKLE_Y);

/** Unité de direction d'un tronc incliné de θ (vers le haut) et sa normale avant. */
export function torsoFrame(theta: number): { up: Point; front: Point } {
  const r = (theta * Math.PI) / 180;
  return { up: pt(Math.sin(r), Math.cos(r)), front: pt(Math.cos(r), -Math.sin(r)) };
}

export const offset = (p: Point, v: Point, k: number): Point => pt(p.x + v.x * k, p.y + v.y * k);

/** Quatre pattes : genou proche au sol, cuisses verticales, mains au sol sous les épaules. */
const QUAD_TRUNK = (() => {
  const make = (t: number) =>
    pose({ trunk: t, hip: t, knee: 90, ankle: -90, anchor: on('kneeL', 0, KNEE_Y) });
  return tune((t) => jointOf(make(t), 'shoulderL').y, 61, 50, 89);
})();

export function quadHands(trunk = QUAD_TRUNK): { handL: Point; handR: Point } {
  const shoulder = jointOf(
    pose({ trunk, hip: trunk, knee: 90, ankle: -90, anchor: on('kneeL', 0, KNEE_Y) }),
    'shoulderL',
  );
  return { handL: pt(shoulder.x + 3, PALM_Y), handR: pt(shoulder.x + 3, PALM_Y) };
}

export function quad(spec: Partial<PoseSpec> = {}): Pose {
  const trunk = spec.trunk ?? QUAD_TRUNK;
  const hands = quadHands(QUAD_TRUNK);
  return pose({
    trunk,
    hip: trunk,
    knee: 90,
    ankle: -90,
    neck: -12,
    anchor: on('kneeL', 0, KNEE_Y),
    grip: 'paume',
    ...spec,
    reach: spec.reach ?? hands,
  });
}

/** Allongé sur le dos, tête à gauche, haut du dos posé en `neck`. */
export function supine(spec: Partial<PoseSpec> = {}, neck: Point = pt(-46, 9.5)): Pose {
  return pose({
    trunk: -90,
    neck: 6,
    shoulder: 0,
    elbow: 4,
    anchor: on('neck', neck.x, neck.y),
    ...spec,
  });
}

/** Allongé sur le ventre, tête à droite. */
export function prone(spec: Partial<PoseSpec> = {}): Pose {
  return pose({
    trunk: 90,
    neck: -8,
    hip: 0,
    knee: 0,
    ankle: -88,
    feet: 'free',
    shoulder: 0,
    elbow: 6,
    anchor: on('pelvis', 0, 9.5),
    ...spec,
  });
}

/** Assis au sol, jambes tendues devant. */
export function seatedFloor(spec: Partial<PoseSpec> = {}): Pose {
  return pose({
    trunk: 0,
    knee: 4,
    ankle: 0,
    feet: 'free',
    anchor: on('pelvis', 0, 11),
    ...spec,
    // Cuisses posées au sol quelle que soit l'inclinaison du buste.
    hip: spec.hip ?? 89 + (spec.trunk ?? 0),
  });
}

/** Assis sur un siège dont le dessus est à `seatTop`, pieds à plat devant. */
export function seated(spec: Partial<PoseSpec> = {}, seatTop = 46, footX = 40): Pose {
  const pelvisY = seatTop + 10;
  return pose({
    trunk: 0,
    anchor: on('pelvis', 0, pelvisY),
    ...spec,
    reach: { ankleL: pt(footX, ANKLE_Y), ankleR: pt(footX, ANKLE_Y), ...spec.reach },
  });
}

/** Main proche amenée à la nuque (mains derrière la tête). */
export function nape(spec: PoseSpec, view: View = 'profil'): Point {
  const sk = solvePose(pose(spec), view);
  const { up, front } = torsoFrame(sk.headTilt);
  return offset(offset(sk.joints.head, front, -9), up, -3);
}

/** Point sur le tronc (t = 0 bassin, t = 1 base du cou), décalé vers l'avant de `ahead`. */
export function onTorso(p: Pose, t: number, ahead: number, view: View = 'profil'): Point {
  const sk = solvePose(p, view);
  const a = sk.joints.pelvis;
  const b = sk.joints.neck;
  const base = pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const tilt = t < 0.5 ? sk.lumbarTilt : sk.thoracicTilt;
  return offset(base, torsoFrame(tilt).front, ahead);
}
