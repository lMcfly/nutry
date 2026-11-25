/**
 * Matériel et décor, dessinés en quelques formes simples : charges tenues en main (haltères,
 * barre, kettlebell), élastiques et câbles, et un petit jeu de pièces (coussin, montant, poulie,
 * pile de plaques…) qui suffit à composer bancs, barres de traction et machines de salle.
 */
import { circle, capsule, line, placeLocal, polygon, smoothClosed } from './outline';
import { add, dir, scale } from './rig';
import type { JointName, Point, SegmentKey, Skeleton } from './rig';
import type { Shape } from './draw';

export const EQUIPMENT_KINDS = [
  'halteres',
  'barre',
  'barre-ez',
  'kettlebell',
  'elastique',
  'banc',
  'banc-incline',
  'tapis',
  'barre-traction',
  'poulie',
  'machine',
  'swiss-ball',
  'mur',
  'chaise',
  'step',
] as const;
export type EquipmentKind = (typeof EQUIPMENT_KINDS)[number];

export const LOAD_KINDS = ['halteres', 'barre', 'barre-ez', 'kettlebell'] as const;
export type LoadKind = (typeof LOAD_KINDS)[number];

/**
 * Point fixe du décor, ou point attaché à une articulation (suit le mouvement) : décalé de
 * (dx, dy), ou dans le repère d'un segment (`along` le long de l'axe, `front` vers l'avant).
 */
export type Ref =
  | Point
  | {
      readonly joint: JointName;
      readonly dx?: number;
      readonly dy?: number;
      readonly seg?: SegmentKey | 'torso';
      readonly along?: number;
      readonly front?: number;
    };

export type Prop =
  | { readonly kind: 'pad'; readonly a: Ref; readonly b: Ref; readonly r: number }
  | { readonly kind: 'frame'; readonly a: Ref; readonly b: Ref; readonly r?: number }
  | { readonly kind: 'wheel'; readonly c: Ref; readonly r: number }
  | { readonly kind: 'cable'; readonly a: Ref; readonly b: Ref }
  | { readonly kind: 'band'; readonly a: Ref; readonly b: Ref }
  | { readonly kind: 'ball'; readonly c: Ref; readonly r: number }
  | { readonly kind: 'mat'; readonly x0: number; readonly x1: number }
  | { readonly kind: 'wall'; readonly x: number; readonly side: 1 | -1; readonly top: number }
  | { readonly kind: 'box'; readonly x0: number; readonly x1: number; readonly h: number }
  | {
      readonly kind: 'stack';
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
    }
  | { readonly kind: 'bar'; readonly c: Ref; readonly top: number };

/** Une pièce de décor, rattachée à un type de matériel (filtrable) et à un plan. */
export interface SceneItem {
  readonly equipment: EquipmentKind;
  readonly prop: Prop;
  /** Devant le mannequin (câbles, élastiques) ; derrière par défaut. */
  readonly front?: boolean;
}

export type LoadHolder = 'hands' | 'handL' | 'handR' | 'back' | 'front' | 'hips' | 'chest';

export interface Load {
  readonly kind: LoadKind;
  readonly at: LoadHolder;
}

export function resolveRef(ref: Ref, sk: Skeleton): Point {
  if ('joint' in ref) {
    const p = sk.joints[ref.joint];
    let x = p.x + (ref.dx ?? 0);
    let y = p.y + (ref.dy ?? 0);
    if (ref.seg === 'torso') {
      // Repère du haut du tronc : `along` vers la tête, `front` vers l'avant.
      const t = (sk.thoracicTilt * Math.PI) / 180;
      const along = ref.along ?? 0;
      const front = ref.front ?? 0;
      x += Math.sin(t) * along + Math.cos(t) * front;
      y += Math.cos(t) * along - Math.sin(t) * front;
    } else if (ref.seg) {
      const psi = (sk.psi[ref.seg] * Math.PI) / 180;
      const s = sk.view === 'profil' || ref.seg.endsWith('L') ? 1 : -1;
      const along = ref.along ?? 0;
      const front = (ref.front ?? 0) * s;
      x += Math.sin(psi) * along + Math.cos(psi) * front;
      y += -Math.cos(psi) * along + Math.sin(psi) * front;
    }
    return { x, y };
  }
  return ref;
}

function propShapes(prop: Prop, sk: Skeleton): Shape[] {
  switch (prop.kind) {
    case 'pad':
      return [
        { d: capsule(resolveRef(prop.a, sk), resolveRef(prop.b, sk), prop.r), tone: 'equipSoft' },
      ];
    case 'frame':
      return [
        {
          d: capsule(resolveRef(prop.a, sk), resolveRef(prop.b, sk), prop.r ?? 1.6),
          tone: 'equip',
        },
      ];
    case 'wheel': {
      const c = resolveRef(prop.c, sk);
      return [
        { d: circle(c, prop.r), tone: 'equip' },
        { d: circle(c, prop.r * 0.4), tone: 'equipSoft' },
      ];
    }
    case 'cable':
      return [{ d: line([resolveRef(prop.a, sk), resolveRef(prop.b, sk)]), tone: 'cable' }];
    case 'band':
      return [{ d: line([resolveRef(prop.a, sk), resolveRef(prop.b, sk)]), tone: 'band' }];
    case 'ball': {
      const c = resolveRef(prop.c, sk);
      return [
        { d: circle(c, prop.r), tone: 'equipSoft' },
        {
          d: smoothClosed(
            placeLocal(c, { x: 1, y: 0 }, { x: 0, y: 1 }, [
              [-prop.r * 0.55, prop.r * 0.45],
              [-prop.r * 0.1, prop.r * 0.72],
              [-prop.r * 0.3, prop.r * 0.4],
              [-prop.r * 0.62, prop.r * 0.12],
            ]),
          ),
          tone: 'ground',
        },
      ];
    }
    case 'mat':
      return [
        { d: capsule({ x: prop.x0, y: 1.1 }, { x: prop.x1, y: 1.1 }, 1.1), tone: 'equipSoft' },
      ];
    case 'wall': {
      const x2 = prop.x + prop.side * 7;
      return [
        {
          d: polygon([
            { x: prop.x, y: 0 },
            { x: prop.x, y: prop.top },
            { x: x2, y: prop.top },
            { x: x2, y: 0 },
          ]),
          tone: 'equipSoft',
        },
      ];
    }
    case 'box':
      return [
        {
          d: polygon([
            { x: prop.x0, y: 0 },
            { x: prop.x0, y: prop.h },
            { x: prop.x1, y: prop.h },
            { x: prop.x1, y: 0 },
          ]),
          tone: 'equipSoft',
        },
        {
          d: capsule({ x: prop.x0 + 1, y: prop.h - 0.8 }, { x: prop.x1 - 1, y: prop.h - 0.8 }, 0.8),
          tone: 'equip',
        },
      ];
    case 'stack': {
      const shapes: Shape[] = [];
      const plates = Math.max(2, Math.round(prop.h / 5));
      for (let i = 0; i < plates; i += 1) {
        const y = prop.y + (i * prop.h) / plates + 2.2;
        shapes.push({
          d: capsule({ x: prop.x - prop.w / 2, y }, { x: prop.x + prop.w / 2, y }, 2),
          tone: 'equip',
        });
      }
      return shapes;
    }
    case 'bar': {
      const c = resolveRef(prop.c, sk);
      return [
        // Potence murale : barre vue en bout, bras horizontal, montant jusqu'au sol.
        {
          d: capsule({ x: c.x - 34, y: 0.8 }, { x: c.x - 34, y: prop.top }, 2.2),
          tone: 'equipSoft',
        },
        { d: capsule({ x: c.x - 34, y: c.y + 7 }, { x: c.x, y: c.y + 7 }, 1.6), tone: 'equip' },
        { d: capsule({ x: c.x, y: c.y }, { x: c.x, y: c.y + 7 }, 1.2), tone: 'equip' },
        { d: circle(c, 2.8), tone: 'equip' },
      ];
    }
  }
}

/** Formes du décor (derrière ou devant le mannequin). */
export function sceneShapes(items: readonly SceneItem[], sk: Skeleton, front: boolean): Shape[] {
  return items
    .filter((item) => (item.front ?? false) === front)
    .flatMap((item) => propShapes(item.prop, sk));
}

function holderPoint(sk: Skeleton, at: LoadHolder): Point {
  const j = sk.joints;
  const t = (sk.thoracicTilt * Math.PI) / 180;
  const upv = { x: Math.sin(t), y: Math.cos(t) };
  const front = { x: upv.y, y: -upv.x };
  switch (at) {
    case 'handL':
      return j.handL;
    case 'handR':
      return j.handR;
    case 'back':
      return add(add(j.neck, scale(upv, -4)), scale(front, -11.5));
    case 'front':
      return add(add(j.neck, scale(upv, -3)), scale(front, 9));
    case 'hips': {
      const lt = (sk.lumbarTilt * Math.PI) / 180;
      return add(j.pelvis, scale({ x: Math.cos(lt), y: -Math.sin(lt) }, 13));
    }
    case 'chest':
    case 'hands':
      return { x: (j.handL.x + j.handR.x) / 2, y: (j.handL.y + j.handR.y) / 2 };
  }
}

/** Axe de profondeur de la vue de profil (vers le côté éloigné), pour les barres et haltères. */
const DEPTH = { x: -0.74, y: 0.67 };

/** Disque vu de trois quarts : une ellipse étroite, orientée selon l'axe de profondeur. */
function plateDisc(c: Point, r: number, thin = 0.42): Shape[] {
  const u = DEPTH;
  const n = { x: -u.y, y: u.x };
  const rim = (k: number): Point[] =>
    Array.from({ length: 12 }, (_, i) => {
      const a = (Math.PI * 2 * i) / 12;
      return add(c, add(scale(u, Math.cos(a) * r * thin * k), scale(n, Math.sin(a) * r * k)));
    });
  return [
    { d: smoothClosed(rim(1)), tone: 'plate' },
    { d: smoothClosed(rim(0.74).map((p) => add(p, scale(u, -r * 0.08)))), tone: 'plateFace' },
  ];
}

export interface Held {
  /** Derrière la main (côté éloigné de la charge). */
  readonly under: Shape[];
  /** Devant la main (côté proche), décalé pour laisser voir la prise. */
  readonly over: Shape[];
}

function dumbbell(sk: Skeleton, hand: 'L' | 'R'): Held {
  const c = sk.joints[`hand${hand}`];
  if (sk.view === 'profil') {
    const back = add(c, scale(DEPTH, 7));
    const front = add(c, scale(DEPTH, -7));
    return {
      under: [{ d: capsule(back, front, 1.5), tone: 'equip' }, ...plateDisc(back, 6.2, 0.5)],
      over: plateDisc(front, 6.2, 0.5),
    };
  }
  const u = dir(sk.psi[`forearm${hand}`]);
  const n = { x: -u.y, y: u.x };
  return {
    under: [{ d: capsule(add(c, scale(n, -8)), add(c, scale(n, 8)), 1.3), tone: 'equip' }],
    over: [
      { d: capsule(add(c, scale(n, -10)), add(c, scale(n, -6)), 4.6), tone: 'plate' },
      { d: capsule(add(c, scale(n, 6)), add(c, scale(n, 10)), 4.6), tone: 'plate' },
    ],
  };
}

/** Rayon d'un disque de barre (≈ 40 cm de diamètre). */
export const PLATE_RADIUS = 19;

/**
 * Barre. Vue de profil : le disque proche, de face, centré sur la barre (le disque éloigné est
 * caché derrière) ; il passe derrière les bras pour que les poings restent visibles, et le bout
 * du manchon dépasse devant. Vue de face : barre horizontale et disques de chant.
 */
function barbell(
  sk: Skeleton,
  c: Point,
  plate: number,
  faceHalf: number,
): Held & { back: Shape[] } {
  if (sk.view === 'profil') {
    const sleeve = add(c, scale(DEPTH, -4.5));
    return {
      back: [
        { d: circle(c, plate), tone: 'plate' },
        { d: circle(c, plate * 0.8), tone: 'plateFace' },
        { d: circle(c, plate * 0.26), tone: 'plate' },
      ],
      under: [],
      over: [
        { d: capsule(c, sleeve, 1.9), tone: 'equip' },
        { d: circle(sleeve, 2.3), tone: 'equip' },
      ],
    };
  }
  const half = faceHalf;
  return {
    back: [],
    under: [
      {
        d: capsule({ x: c.x - half - 12, y: c.y }, { x: c.x + half + 12, y: c.y }, 1.3),
        tone: 'equip',
      },
    ],
    over: [-1, 1].flatMap((s) => [
      {
        d: capsule(
          { x: c.x + s * half, y: c.y - plate },
          { x: c.x + s * half, y: c.y + plate },
          2.6,
        ),
        tone: 'plate' as const,
      },
      {
        d: capsule(
          { x: c.x + s * (half + 5), y: c.y - plate * 0.78 },
          { x: c.x + s * (half + 5), y: c.y + plate * 0.78 },
          2.2,
        ),
        tone: 'plateFace' as const,
      },
    ]),
  };
}

function kettlebell(c: Point, down: Point): Shape[] {
  const bell = add(c, scale(down, 9.5));
  const n = { x: -down.y, y: down.x };
  return [
    {
      d: capsule(add(c, scale(n, -3.6)), add(add(c, scale(n, -4.6)), scale(down, 5)), 1.3),
      tone: 'equip',
    },
    {
      d: capsule(add(c, scale(n, 3.6)), add(add(c, scale(n, 4.6)), scale(down, 5)), 1.3),
      tone: 'equip',
    },
    { d: capsule(add(c, scale(n, -3.2)), add(c, scale(n, 3.2)), 1.3), tone: 'equip' },
    {
      d: smoothClosed(
        placeLocal(bell, n, scale(down, -1), [
          [0, 4.6],
          [6.4, 2.4],
          [7.6, -2.4],
          [4.4, -7],
          [-4.4, -7],
          [-7.6, -2.4],
          [-6.4, 2.4],
        ]),
      ),
      tone: 'plate',
    },
  ];
}

export interface LoadDrawing {
  /** Derrière tout le mannequin. */
  readonly back: Shape[];
  /** Par main : sous la main et devant la main. */
  readonly L: Held;
  readonly R: Held;
  /** Devant le mannequin. */
  readonly front: Shape[];
}

/** Formes d'une charge, réparties en plans pour que la prise reste visible. */
export function loadShapes(load: Load, sk: Skeleton, frameHalf: number): LoadDrawing {
  const out: LoadDrawing = {
    back: [],
    L: { under: [], over: [] },
    R: { under: [], over: [] },
    front: [],
  };
  if (load.kind === 'halteres') {
    for (const hand of ['L', 'R'] as const) {
      const skip = hand === 'L' ? load.at === 'handR' : load.at === 'handL' || load.at === 'chest';
      if (skip) continue;
      const d = dumbbell(sk, hand);
      out[hand].under.push(...d.under);
      out[hand].over.push(...d.over);
    }
    return out;
  }
  if (load.kind === 'kettlebell') {
    const c = holderPoint(sk, load.at);
    const down = load.at === 'chest' ? { x: 0, y: -1 } : dir(sk.psi.forearmL);
    // L'anse passe sous les doigts : la cloche est dessinée sous la main proche.
    out.L.under.push(...kettlebell(c, down));
    return out;
  }
  const c = holderPoint(sk, load.at);
  const bar = barbell(sk, c, load.kind === 'barre' ? PLATE_RADIUS : 12.5, frameHalf + 22);
  out.back.push(...bar.back);
  out.L.under.push(...bar.under);
  out.front.push(...bar.over);
  return out;
}
