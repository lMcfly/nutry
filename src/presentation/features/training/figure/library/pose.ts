/**
 * Écriture concise des poses : valeurs par défaut (debout, bras le long du corps), angles
 * communs aux deux côtés, surcharges par côté, pieds à plat sauf angle de cheville explicite.
 */
import { ANGLE_KEYS } from '../rig';
import type {
  Anchor,
  AngleKey,
  ContactPoint,
  Effector,
  FoldKey,
  FootMode,
  Grip,
  JointName,
  Point,
  Pose,
} from '../rig';

type Bilateral = 'hip' | 'knee' | 'ankle' | 'shoulder' | 'elbow';

export type PoseSpec = Partial<Record<AngleKey | Bilateral, number>> & {
  readonly anchor: Anchor;
  readonly reach?: Partial<Record<Effector, Point>>;
  readonly bend?: Partial<Record<Effector, 1 | -1>>;
  readonly feet?: FootMode | 'free' | Partial<Record<'L' | 'R', FootMode | 'free'>>;
  readonly fold?: Partial<Record<FoldKey, number>>;
  /** Prise : une valeur pour les deux mains, ou par main. */
  readonly grip?: Grip | Partial<Record<'L' | 'R', Grip>>;
  readonly contacts?: readonly ContactPoint[];
};

const DEFAULTS: Record<AngleKey, number> = {
  trunk: 0,
  spine: 0,
  neck: 0,
  shrug: 0,
  hipL: 0,
  kneeL: 0,
  ankleL: 0,
  hipR: 0,
  kneeR: 0,
  ankleR: 0,
  shoulderL: 0,
  elbowL: 8,
  shoulderR: 0,
  elbowR: 8,
};

export function pose(spec: PoseSpec): Pose {
  const angles = { ...DEFAULTS };
  for (const key of ANGLE_KEYS) {
    const side = key.endsWith('L') || key.endsWith('R') ? key.slice(0, -1) : null;
    const own = spec[key];
    const shared = side === null ? undefined : spec[side as Bilateral];
    if (own !== undefined) angles[key] = own;
    else if (shared !== undefined) angles[key] = shared;
  }
  const feet: Partial<Record<'L' | 'R', FootMode>> = {};
  for (const side of ['L', 'R'] as const) {
    const explicit =
      typeof spec.feet === 'string' || typeof spec.feet === 'number'
        ? spec.feet
        : spec.feet
          ? spec.feet[side]
          : undefined;
    if (explicit === 'free') continue;
    if (explicit !== undefined) feet[side] = explicit;
    else if (spec[`ankle${side}`] === undefined && spec.ankle === undefined) feet[side] = 'flat';
  }
  return {
    angles,
    anchor: spec.anchor,
    feet,
    ...(spec.reach ? { reach: spec.reach } : {}),
    ...(spec.bend ? { bend: spec.bend } : {}),
    ...(spec.fold ? { fold: spec.fold } : {}),
    ...(spec.grip
      ? { grip: typeof spec.grip === 'string' ? { L: spec.grip, R: spec.grip } : spec.grip }
      : {}),
    ...(spec.contacts ? { contacts: spec.contacts } : {}),
  };
}

export const pt = (x: number, y: number): Point => ({ x, y });
export const on = (joint: JointName, x: number, y: number): Anchor => ({ joint, at: { x, y } });
export const ground = (x: number, lift = 0): Anchor => ({ ground: x, lift });

/** Hauteur de la cheville quand le pied est à plat. */
export const ANKLE_Y = 6;
/** Hauteur du centre de la main posée au sol. */
export const PALM_Y = 3;
/** Hauteur de l'articulation du genou posé au sol. */
export const KNEE_Y = 5;
