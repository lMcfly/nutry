/**
 * Rig du mannequin : squelette plan défini par des angles d'articulation et une ancre.
 *
 * Conventions (unités ≈ centimètres, y vers le haut, sol à y = 0) :
 * - Vue de profil : le mannequin regarde vers +x ; côté gauche (L) près de nous, droit (R) au fond.
 *   Vue de face ou de dessus : la gauche du mannequin est à droite de l'image (+x).
 * - Les angles sont en degrés, relatifs au segment parent, positifs en flexion :
 *   `trunk` incline le bassin-taille vers l'avant, `spine` enroule le haut du dos,
 *   `neck` penche la tête, `hip` / `shoulder` amènent cuisse / bras vers l'avant (abduction en
 *   vue de face), `knee` / `elbow` fléchissent, `ankle` relève la pointe du pied.
 *   `shrug` monte les épaules (unités).
 * - La pose est placée dans le monde par une ancre : une articulation posée en un point, ou le
 *   point le plus bas posé au sol (`ground`). Les effecteurs `reach` (mains, chevilles) sont
 *   amenés sur une cible par cinématique inverse à deux segments.
 *
 * Tout est pur : aucune dépendance au DOM, testable en isolation.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type View = 'profil' | 'face' | 'dessus';

export const ANGLE_KEYS = [
  'trunk',
  'spine',
  'neck',
  'shrug',
  'hipL',
  'kneeL',
  'ankleL',
  'hipR',
  'kneeR',
  'ankleR',
  'shoulderL',
  'elbowL',
  'shoulderR',
  'elbowR',
] as const;
export type AngleKey = (typeof ANGLE_KEYS)[number];
export type Angles = Readonly<Record<AngleKey, number>>;

export type LimbSide = 'L' | 'R';
export type Effector = 'handL' | 'handR' | 'ankleL' | 'ankleR';
/** Pied à plat, sur la pointe, ou orienté selon une direction absolue ψ (degrés). */
export type FootMode = 'flat' | 'toes' | number;

export const FOLD_KEYS = [
  'torso',
  'thighL',
  'thighR',
  'shinL',
  'shinR',
  'upperArmL',
  'upperArmR',
  'forearmL',
  'forearmR',
] as const;
/** Raccourci apparent d'un segment qui sort du plan de l'image (1 = dans le plan). */
export type FoldKey = (typeof FOLD_KEYS)[number];

export type JointName =
  | 'pelvis'
  | 'waist'
  | 'neck'
  | 'head'
  | 'hipL'
  | 'hipR'
  | 'kneeL'
  | 'kneeR'
  | 'ankleL'
  | 'ankleR'
  | 'heelL'
  | 'heelR'
  | 'toeL'
  | 'toeR'
  | 'shoulderL'
  | 'shoulderR'
  | 'elbowL'
  | 'elbowR'
  | 'wristL'
  | 'wristR'
  | 'handL'
  | 'handR';

export type Anchor =
  | { readonly joint: JointName; readonly at: Point }
  | { readonly ground: number; readonly lift?: number };

/**
 * Prise de la main : sur une barre ou une poignée (pronation, supination, neutre), à plat sur un
 * appui (paume, poignet cassé, doigts vers l'avant), dans le prolongement de l'avant-bras posé
 * (avant-bras au sol), ou derrière la tête.
 */
export type Grip = 'pronation' | 'supination' | 'neutre' | 'paume' | 'plat' | 'nuque';

/** Point d'appui visible : articulation au contact d'un support (sol, banc, mur, machine). */
export type ContactPoint =
  | 'pelvis'
  | 'neck'
  | 'head'
  | 'heelL'
  | 'heelR'
  | 'toeL'
  | 'toeR'
  | 'kneeL'
  | 'kneeR'
  | 'handL'
  | 'handR'
  | 'elbowL'
  | 'elbowR'
  | 'ankleL'
  | 'ankleR';

export interface Pose {
  readonly angles: Angles;
  /** Prises des mains (dessinées : poing, paume, poignet cassé). */
  readonly grip?: Readonly<Partial<Record<LimbSide, Grip>>>;
  /** Appuis (dessinés par une marque discrète sous le point de contact). */
  readonly contacts?: readonly ContactPoint[];
  readonly anchor: Anchor;
  readonly reach?: Readonly<Partial<Record<Effector, Point>>>;
  /** Sens de flexion choisi par la cinématique inverse (1 par défaut : flexion positive). */
  readonly bend?: Readonly<Partial<Record<Effector, 1 | -1>>>;
  readonly feet?: Readonly<Partial<Record<LimbSide, FootMode>>>;
  readonly fold?: Readonly<Partial<Record<FoldKey, number>>>;
}

/** Morphologie qui influe sur le squelette : demi-largeurs d'épaules et de hanches (vue de face). */
export interface Frame {
  readonly shoulderHalf: number;
  readonly hipHalf: number;
}

export const DEFAULT_FRAME: Frame = { shoulderHalf: 15, hipHalf: 8.5 };

/**
 * Vue de profil : décalage à l'écran des membres du côté éloigné (droit), comme vus d'un peu
 * au-dessus et de trois quarts, pour que les deux bras, les deux mains et les deux pieds se
 * lisent. Les cibles du côté éloigné sont décalées de même (un pied posé reste posé).
 */
export const FAR_OFFSET: Point = { x: -2.6, y: 2.4 };

/** Longueurs des segments (≈ cm, silhouette de 7,5 têtes). Identiques pour les deux corps. */
export const LENGTHS = {
  lumbar: 25,
  thoracic: 25,
  shoulderDrop: 5.5,
  neck: 7,
  headOffset: 9.5,
  headRadius: 10.5,
  thigh: 43,
  shin: 41,
  upperArm: 29,
  forearm: 25,
  hand: 4.5,
  ankleHeight: 6,
  toe: 14,
  heel: 4.5,
} as const;

export interface Skeleton {
  readonly view: View;
  readonly joints: Readonly<Record<JointName, Point>>;
  /** Angles après cinématique inverse et réglage des pieds. */
  readonly angles: Angles;
  /** Directions absolues (degrés depuis la verticale descendante, vers +x positif). */
  readonly psi: Readonly<Record<SegmentKey, number>>;
  readonly fold: Readonly<Record<FoldKey, number>>;
  /** Inclinaison absolue du bas du tronc, du haut du tronc et de la tête (depuis la verticale). */
  readonly lumbarTilt: number;
  readonly thoracicTilt: number;
  readonly headTilt: number;
}

export type SegmentKey =
  | 'thighL'
  | 'thighR'
  | 'shinL'
  | 'shinR'
  | 'footL'
  | 'footR'
  | 'upperArmL'
  | 'upperArmR'
  | 'forearmL'
  | 'forearmR';

const RAD = Math.PI / 180;

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpPoint = (a: Point, b: Point, t: number): Point => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
});

/** Direction d'un segment d'angle ψ (0 = vers le bas, 90 = vers +x). */
export function dir(psi: number): Point {
  return { x: Math.sin(psi * RAD), y: -Math.cos(psi * RAD) };
}

/** Direction « vers le haut » d'un tronc incliné de θ (0 = vertical, 90 = vers +x). */
function up(theta: number): Point {
  return { x: Math.sin(theta * RAD), y: Math.cos(theta * RAD) };
}

/** Angle ψ de la direction (dx, dy). */
export function psiOf(v: Point): number {
  return Math.atan2(v.x, -v.y) / RAD;
}

/** Ramène un angle dans ]-180, 180]. */
export function normalize(angle: number): number {
  let a = angle % 360;
  if (a <= -180) a += 360;
  if (a > 180) a -= 360;
  return a;
}

const sideSign = (view: View, side: LimbSide): 1 | -1 =>
  view === 'profil' || side === 'L' ? 1 : -1;

function fullFold(fold: Pose['fold']): Record<FoldKey, number> {
  const out = {} as Record<FoldKey, number>;
  for (const key of FOLD_KEYS) out[key] = fold?.[key] ?? 1;
  return out;
}

interface Fk {
  readonly joints: Record<JointName, Point>;
  readonly psi: Record<SegmentKey, number>;
  readonly lumbarTilt: number;
  readonly thoracicTilt: number;
  readonly headTilt: number;
}

/** Cinématique directe, bassin en `pelvis`. */
function forward(
  a: Angles,
  pelvis: Point,
  view: View,
  frame: Frame,
  fold: Record<FoldKey, number>,
): Fk {
  const lumbarTilt = a.trunk;
  const thoracicTilt = a.trunk + a.spine;
  const headTilt = thoracicTilt + a.neck;
  const lateral = view !== 'profil';
  const waist = add(pelvis, scale(up(lumbarTilt), LENGTHS.lumbar * fold.torso));
  const neck = add(waist, scale(up(thoracicTilt), LENGTHS.thoracic * fold.torso));
  const shoulderBase = add(neck, scale(up(thoracicTilt), a.shrug - LENGTHS.shoulderDrop));
  const neckTop = add(neck, scale(up(headTilt), LENGTHS.neck));
  const head = add(neckTop, scale(up(headTilt), LENGTHS.headOffset));
  // Perpendiculaire « vers la gauche du mannequin » (vue de face) : +x quand le tronc est droit.
  const perp = (theta: number): Point => ({ x: Math.cos(theta * RAD), y: -Math.sin(theta * RAD) });

  const joints = { pelvis, waist, neck, head } as Record<JointName, Point>;
  const psi = {} as Record<SegmentKey, number>;
  for (const side of ['L', 'R'] as const) {
    const s = sideSign(view, side);
    const far = !lateral && side === 'R' ? FAR_OFFSET : { x: 0, y: 0 };
    const hip = lateral
      ? add(pelvis, scale(perp(lumbarTilt), s * frame.hipHalf))
      : add(pelvis, far);
    const shoulder = lateral
      ? add(shoulderBase, scale(perp(thoracicTilt), s * frame.shoulderHalf))
      : add(shoulderBase, far);
    const thigh = -lumbarTilt + s * a[`hip${side}`];
    const shin = thigh - s * a[`knee${side}`];
    const foot = shin + s * (90 + a[`ankle${side}`]);
    const knee = add(hip, scale(dir(thigh), LENGTHS.thigh * fold[`thigh${side}`]));
    const ankle = add(knee, scale(dir(shin), LENGTHS.shin * fold[`shin${side}`]));
    const footDir = dir(foot);
    const sole = { x: s * footDir.y, y: -s * footDir.x };
    const upper = -thoracicTilt + s * a[`shoulder${side}`];
    const fore = upper + s * a[`elbow${side}`];
    const elbow = add(shoulder, scale(dir(upper), LENGTHS.upperArm * fold[`upperArm${side}`]));
    const wrist = add(elbow, scale(dir(fore), LENGTHS.forearm * fold[`forearm${side}`]));
    joints[`hip${side}`] = hip;
    joints[`knee${side}`] = knee;
    joints[`ankle${side}`] = ankle;
    joints[`heel${side}`] = add(
      add(ankle, scale(footDir, -LENGTHS.heel)),
      scale(sole, LENGTHS.ankleHeight),
    );
    joints[`toe${side}`] = add(
      add(ankle, scale(footDir, LENGTHS.toe)),
      scale(sole, LENGTHS.ankleHeight),
    );
    joints[`shoulder${side}`] = shoulder;
    joints[`elbow${side}`] = elbow;
    joints[`wrist${side}`] = wrist;
    joints[`hand${side}`] = add(wrist, scale(dir(fore), LENGTHS.hand * fold[`forearm${side}`]));
    psi[`thigh${side}`] = thigh;
    psi[`shin${side}`] = shin;
    psi[`foot${side}`] = foot;
    psi[`upperArm${side}`] = upper;
    psi[`forearm${side}`] = fore;
  }
  return { joints, psi, lumbarTilt, thoracicTilt, headTilt };
}

/** Rayons approximatifs de la silhouette autour de chaque articulation (pose au sol). */
const CONTACT_RADII: Partial<Record<JointName, number>> = {
  pelvis: 10,
  waist: 9,
  neck: 9,
  head: 10.5,
  kneeL: 5,
  kneeR: 5,
  heelL: 0,
  heelR: 0,
  toeL: 0,
  toeR: 0,
  elbowL: 4,
  elbowR: 4,
  handL: 3,
  handR: 3,
  shoulderL: 6,
  shoulderR: 6,
};

function lowestPoint(joints: Record<JointName, Point>): number {
  let min = Infinity;
  for (const [name, radius] of Object.entries(CONTACT_RADII)) {
    const p = joints[name as JointName];
    min = Math.min(min, p.y - radius);
  }
  return min;
}

function placePelvis(fk: Fk, anchor: Anchor, view: View): Point {
  if ('joint' in anchor) {
    // Comme les cibles : un point d'appui du côté éloigné est décalé par la perspective.
    const far = view === 'profil' && anchor.joint.endsWith('R');
    return sub(far ? add(anchor.at, FAR_OFFSET) : anchor.at, fk.joints[anchor.joint]);
  }
  return { x: anchor.ground, y: (anchor.lift ?? 0) - lowestPoint(fk.joints) };
}

/** Cinématique inverse à deux segments : directions absolues des deux segments. */
function twoBone(
  root: Point,
  target: Point,
  a: number,
  b: number,
  flexSign: (first: number, second: number) => number,
): [number, number] {
  const d = Math.min(Math.max(dist(root, target), Math.abs(a - b) + 1e-3), a + b - 1e-3);
  const base = psiOf(sub(target, root));
  const alpha = Math.acos((a * a + d * d - b * b) / (2 * a * d)) / RAD;
  const candidates = [base + alpha, base - alpha].map((first): [number, number] => {
    const joint = add(root, scale(dir(first), a));
    return [first, psiOf(sub(target, joint))];
  });
  const [c1, c2] = candidates as [[number, number], [number, number]];
  return flexSign(c1[0], c1[1]) >= 0 ? c1 : c2;
}

function footAngleForToes(ankleY: number, shinPsi: number, s: 1 | -1): number {
  const { toe, ankleHeight } = LENGTHS;
  const r = Math.hypot(toe, ankleHeight);
  const phase = Math.atan2(ankleHeight, toe) / RAD;
  const ratio = Math.min(Math.max(ankleY / r, -1), 1);
  const psiFoot = s * (phase + Math.acos(ratio) / RAD);
  return normalize(s * (psiFoot - shinPsi) - 90);
}

/**
 * Résout une pose : place le bassin, applique la cinématique inverse et le réglage des pieds,
 * puis calcule toutes les articulations.
 */
export function solvePose(pose: Pose, view: View, frame: Frame = DEFAULT_FRAME): Skeleton {
  const fold = fullFold(pose.fold);
  const angles: Record<AngleKey, number> = { ...pose.angles };
  const origin = { x: 0, y: 0 };

  const applyFlat = () => {
    const fk = forward(angles, origin, view, frame, fold);
    for (const side of ['L', 'R'] as const) {
      const mode = pose.feet?.[side];
      if (mode === 'flat' || typeof mode === 'number') {
        const s = sideSign(view, side);
        const target = s * (mode === 'flat' ? 90 : mode);
        angles[`ankle${side}`] = normalize(s * (target - fk.psi[`shin${side}`]) - 90);
      }
    }
  };

  applyFlat();
  let pelvis = placePelvis(forward(angles, origin, view, frame, fold), pose.anchor, view);

  const reach = pose.reach ?? {};
  const shift = (p: Point | undefined, side: LimbSide): Point | undefined =>
    p && view === 'profil' && side === 'R' ? add(p, FAR_OFFSET) : p;
  for (const side of ['L', 'R'] as const) {
    const s = sideSign(view, side);
    const handTarget = shift(reach[`hand${side}`], side);
    if (handTarget) {
      const fk = forward(angles, pelvis, view, frame, fold);
      const bend = pose.bend?.[`hand${side}`] ?? 1;
      const [upper, fore] = twoBone(
        fk.joints[`shoulder${side}`],
        handTarget,
        LENGTHS.upperArm * fold[`upperArm${side}`],
        (LENGTHS.forearm + LENGTHS.hand) * fold[`forearm${side}`],
        (first, second) => bend * normalize(s * (second - first)),
      );
      angles[`shoulder${side}`] = normalize(s * (upper + fk.thoracicTilt));
      angles[`elbow${side}`] = normalize(s * (fore - upper));
    }
    const ankleTarget = shift(reach[`ankle${side}`], side);
    if (ankleTarget) {
      const fk = forward(angles, pelvis, view, frame, fold);
      const bend = pose.bend?.[`ankle${side}`] ?? 1;
      const [thigh, shin] = twoBone(
        fk.joints[`hip${side}`],
        ankleTarget,
        LENGTHS.thigh * fold[`thigh${side}`],
        LENGTHS.shin * fold[`shin${side}`],
        (first, second) => bend * normalize(s * (first - second)),
      );
      angles[`hip${side}`] = normalize(s * (thigh + fk.lumbarTilt));
      angles[`knee${side}`] = normalize(s * (thigh - shin));
    }
  }

  applyFlat();
  // Si l'ancre est sur un pied réglé à plat après coup, on la replace.
  if ('joint' in pose.anchor) {
    pelvis = placePelvis(forward(angles, origin, view, frame, fold), pose.anchor, view);
  }

  for (const side of ['L', 'R'] as const) {
    if (pose.feet?.[side] === 'toes') {
      const fk = forward(angles, pelvis, view, frame, fold);
      const groundY = view === 'profil' && side === 'R' ? FAR_OFFSET.y : 0;
      angles[`ankle${side}`] = footAngleForToes(
        fk.joints[`ankle${side}`].y - groundY,
        fk.psi[`shin${side}`],
        sideSign(view, side),
      );
    }
  }

  const fk = forward(angles, pelvis, view, frame, fold);
  return {
    view,
    joints: fk.joints,
    angles,
    psi: fk.psi,
    fold,
    lumbarTilt: fk.lumbarTilt,
    thoracicTilt: fk.thoracicTilt,
    headTilt: fk.headTilt,
  };
}

/** Pose « figée » : angles résolus, ancre ramenée au bassin (pour l'interpolation). */
export function bakePose(pose: Pose, view: View, frame: Frame = DEFAULT_FRAME): Pose {
  const skeleton = solvePose(pose, view, frame);
  return { ...pose, angles: skeleton.angles };
}

/** Nom symétrique : `kneeL` ↔ `kneeR` ; les noms centraux restent inchangés. */
function swapName(key: string): string {
  if (key.endsWith('L')) return `${key.slice(0, -1)}R`;
  if (key.endsWith('R')) return `${key.slice(0, -1)}L`;
  return key;
}

function swapRecord<V>(record: Readonly<Partial<Record<string, V>>> | undefined) {
  if (!record) return undefined;
  const out: Partial<Record<string, V>> = {};
  for (const [key, value] of Object.entries(record)) out[swapName(key)] = value;
  return out;
}

/** Échange les côtés gauche et droit (exercice unilatéral montré de l'autre côté). */
export function mirrorPose(pose: Pose): Pose {
  const angles = { ...pose.angles };
  for (const key of ANGLE_KEYS) angles[key] = pose.angles[swapName(key) as AngleKey];
  const anchor: Anchor =
    'joint' in pose.anchor
      ? { joint: swapName(pose.anchor.joint) as JointName, at: pose.anchor.at }
      : pose.anchor;
  const mirrored: { -readonly [K in keyof Pose]: Pose[K] } = { angles, anchor };
  if (pose.reach) mirrored.reach = swapRecord(pose.reach) ?? {};
  if (pose.bend) mirrored.bend = swapRecord(pose.bend) ?? {};
  if (pose.feet) mirrored.feet = swapRecord(pose.feet) ?? {};
  if (pose.fold) mirrored.fold = swapRecord(pose.fold) ?? {};
  if (pose.grip) mirrored.grip = swapRecord(pose.grip) ?? {};
  if (pose.contacts) mirrored.contacts = pose.contacts.map((c) => swapName(c) as ContactPoint);
  return mirrored;
}
