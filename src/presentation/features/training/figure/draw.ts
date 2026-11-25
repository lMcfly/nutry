/**
 * Dessin du mannequin : du squelette résolu à une liste de formes SVG (chemins + teinte).
 * Le rendu (React ou chaîne SVG) ne fait que poser chaque chemin avec la classe de sa teinte.
 */
import { widthAt } from './body';
import type { BodyShape, Silhouette, WidthProfile } from './body';
import { MUSCLE_REGIONS } from './muscles';
import type { FigureMuscle, SegmentPart } from './muscles';
import {
  placeLocal,
  segmentAxis,
  segmentOutline,
  sideLens,
  smoothClosed,
  torsoAxis,
} from './outline';
import type { Axis } from './outline';
import { add, dir, scale } from './rig';
import type { Grip, LimbSide, Skeleton } from './rig';

export type Tone =
  | 'skin'
  | 'top'
  | 'bottom'
  | 'shoe'
  | 'sole'
  | 'hair'
  | 'shade'
  | 'highlight'
  | 'equip'
  | 'equipSoft'
  | 'equipLine'
  | 'plate'
  | 'plateFace'
  | 'band'
  | 'cable'
  | 'ground'
  | 'shadow'
  | 'contact'
  | 'guide'
  | 'guideHead'
  | 'skinLine';

export interface Shape {
  readonly d: string;
  readonly tone: Tone;
  /** Membre du côté éloigné (vue de profil) : légèrement assombri. */
  readonly far?: boolean;
}

/** Lumière venant du haut et de l'avant : sert à choisir le côté ombré de chaque segment. */
const LIGHT = { x: 0.6, y: 0.8 };

const NECK: WidthProfile = { t: [0, 1], front: [4.4, 3.9], back: [4.6, 4.0] };

interface Limb {
  readonly part: SegmentPart;
  readonly axis: Axis;
  readonly profile: WidthProfile;
}

function shadeSide(axis: Axis): 'front' | 'back' {
  const n = axis.normal(0.5);
  return n.x * LIGHT.x + n.y * LIGHT.y >= 0 ? 'back' : 'front';
}

function pushLimb(
  out: Shape[],
  limb: Limb,
  cover: { tone: Tone; to: number; from?: number } | null,
  far: boolean,
  muscles: readonly FigureMuscle[],
  lateral: boolean,
) {
  const flag = far ? { far: true } : {};
  out.push({
    d: smoothClosed(segmentOutline(limb.axis, limb.profile, 0, 1)),
    tone: 'skin',
    ...flag,
  });
  if (cover && cover.to > (cover.from ?? 0)) {
    out.push({
      d: smoothClosed(segmentOutline(limb.axis, limb.profile, cover.from ?? 0, cover.to, 1.06)),
      tone: cover.tone,
      ...flag,
    });
  }
  out.push({
    d: smoothClosed(
      sideLens(limb.axis, limb.profile, 0.02, 0.98, shadeSide(limb.axis), 0.3, 1, 0.3),
    ),
    tone: 'shade',
    ...flag,
  });
  pushMuscles(out, limb, muscles, lateral, far);
}

function pushMuscles(
  out: Shape[],
  limb: Limb,
  muscles: readonly FigureMuscle[],
  lateral: boolean,
  far: boolean,
) {
  for (const muscle of muscles) {
    for (const region of MUSCLE_REGIONS[muscle]) {
      if (region.part !== limb.part) continue;
      const side = lateral ? 'all' : region.side;
      out.push({
        d: smoothClosed(
          sideLens(limb.axis, limb.profile, region.from, region.to, side, -0.12, 0.96, 0.55),
        ),
        tone: 'highlight',
        ...(far ? { far: true } : {}),
      });
    }
  }
}

function headShapes(sk: Skeleton, body: BodyShape): Shape[] {
  const c = sk.joints.head;
  const theta = (sk.headTilt * Math.PI) / 180;
  const u = { x: Math.sin(theta), y: Math.cos(theta) };
  const f = { x: Math.cos(theta), y: -Math.sin(theta) };
  // Gabarits locaux (x vers l'avant / la gauche du mannequin, y vers le haut).
  const profileHead: [number, number][] = [
    [0.5, 11.2],
    [6.4, 8.9],
    [9.3, 4.2],
    [9.9, -0.4],
    [9.0, -5.4],
    [6.6, -9.6],
    [2.0, -11.3],
    [-3.6, -8.6],
    [-8.6, -3.6],
    [-10.6, 2.2],
    [-7.8, 8.6],
  ];
  const faceHead: [number, number][] = [
    [0, 11.4],
    [6.6, 9.2],
    [9.0, 3.2],
    [8.4, -4.0],
    [5.4, -9.4],
    [0, -11.6],
    [-5.4, -9.4],
    [-8.4, -4.0],
    [-9.0, 3.2],
    [-6.6, 9.2],
  ];
  const profileHair: [number, number][] = [
    [-11.3, 1.5],
    [-10.9, 7.4],
    [-6.6, 11.6],
    [0.6, 12.4],
    [6.8, 10.1],
    [9.9, 5.6],
    [7.4, 6.4],
    [2.8, 6.8],
    [-1.6, 3.6],
    [-5.2, 0.2],
    [-8.6, -3.4],
  ];
  const faceHair: [number, number][] = [
    [-9.6, 2.0],
    [-9.2, 8.0],
    [-5.0, 11.8],
    [0, 12.6],
    [5.0, 11.8],
    [9.2, 8.0],
    [9.6, 2.0],
    [7.6, 6.6],
    [3.0, 8.2],
    [0, 8.0],
    [-3.0, 8.2],
    [-7.6, 6.6],
  ];
  const lateral = sk.view !== 'profil';
  const shapes: Shape[] = [];
  if (body.hair === 'chignon') {
    const bun = lateral ? add(c, scale(u, 12.5)) : add(add(c, scale(u, 8.2)), scale(f, -8.4));
    shapes.push({
      d: smoothClosed(
        placeLocal(bun, f, u, [
          [0, 5],
          [4.6, 2],
          [3.8, -3.4],
          [0, -4.8],
          [-4.2, -2.8],
          [-4.6, 2.2],
        ]),
      ),
      tone: 'hair',
    });
  }
  shapes.push({
    d: smoothClosed(placeLocal(c, f, u, lateral ? faceHead : profileHead)),
    tone: 'skin',
  });
  if (!lateral) {
    // Oreille, discrète.
    shapes.push({
      d: smoothClosed(
        placeLocal(add(c, scale(f, -1.4)), f, u, [
          [0, 2.6],
          [1.6, 0.6],
          [0.6, -2.6],
          [-1.2, -1.2],
          [-1.4, 1.4],
        ]),
      ),
      tone: 'shade',
    });
  }
  const hair = lateral ? faceHair : profileHair;
  const longer =
    body.hair === 'chignon'
      ? hair.map(([x, y]): [number, number] => [x * 1.04, y + (y > 6 ? 0.4 : 0)])
      : hair;
  shapes.push({ d: smoothClosed(placeLocal(c, f, u, longer)), tone: 'hair' });
  return shapes;
}

function shoeShapes(sk: Skeleton, side: LimbSide, far: boolean): Shape[] {
  const ankle = sk.joints[`ankle${side}`];
  const s = sk.view === 'profil' || side === 'L' ? 1 : -1;
  const u = dir(sk.psi[`foot${side}`]);
  const n = { x: -s * u.y, y: s * u.x };
  const flag = far ? { far: true } : {};
  if (sk.view !== 'profil' && Math.abs(Math.abs(sk.psi[`foot${side}`]) - 90) < 35) {
    // Vue de face : chaussure vue de l'avant.
    return [
      {
        d: smoothClosed(
          placeLocal(ankle, u, n, [
            [-4.2, -6.2],
            [5.6, -6.2],
            [6.6, -3.4],
            [4.6, 1.2],
            [-3.0, 2.2],
            [-5.0, -2.0],
          ]),
        ),
        tone: 'shoe',
        ...flag,
      },
      {
        d: smoothClosed(
          placeLocal(ankle, u, n, [
            [-4.4, -6.4],
            [5.8, -6.4],
            [6.4, -4.8],
            [-4.9, -4.8],
          ]),
        ),
        tone: 'sole',
        ...flag,
      },
    ];
  }
  return [
    {
      d: smoothClosed(
        placeLocal(ankle, u, n, [
          [-5.6, -1.6],
          [-5.9, -4.8],
          [-4.2, -6.2],
          [6, -6.2],
          [13.4, -6.1],
          [15.6, -4.6],
          [15, -2.6],
          [10.8, -1.0],
          [6.2, 1.2],
          [2.6, 3.6],
          [-2.8, 3.8],
        ]),
      ),
      tone: 'shoe',
      ...flag,
    },
    {
      d: smoothClosed(
        placeLocal(ankle, u, n, [
          [-5.9, -4.6],
          [-4.4, -6.5],
          [13.6, -6.5],
          [15.8, -4.6],
          [13.8, -4.9],
          [-4.0, -4.9],
        ]),
      ),
      tone: 'sole',
      ...flag,
    },
  ];
}

function limbs(sk: Skeleton, sil: Silhouette, side: LimbSide) {
  const j = sk.joints;
  const s = sk.view === 'profil' || side === 'L' ? 1 : -1;
  return {
    thigh: {
      part: 'thigh',
      axis: segmentAxis(j[`hip${side}`], j[`knee${side}`], s),
      profile: sil.thigh,
    },
    shin: {
      part: 'shin',
      axis: segmentAxis(j[`knee${side}`], j[`ankle${side}`], s),
      profile: sil.shin,
    },
    upperArm: {
      part: 'upperArm',
      axis: segmentAxis(j[`shoulder${side}`], j[`elbow${side}`], s),
      profile: sil.upperArm,
    },
    forearm: {
      part: 'forearm',
      axis: segmentAxis(j[`elbow${side}`], j[`wrist${side}`], s),
      profile: sil.forearm,
    },
  } satisfies Record<string, Limb>;
}

function legShapes(
  sk: Skeleton,
  body: BodyShape,
  sil: Silhouette,
  side: LimbSide,
  far: boolean,
  muscles: readonly FigureMuscle[],
): Shape[] {
  const out: Shape[] = [];
  const lateral = sk.view !== 'profil';
  const l = limbs(sk, sil, side);
  const { outfit } = body;
  pushLimb(out, l.thigh, { tone: 'bottom', to: outfit.thigh }, far, muscles, lateral);
  pushLimb(out, l.shin, { tone: 'bottom', to: outfit.shin }, far, muscles, lateral);
  out.push(...shoeShapes(sk, side, far));
  return out;
}

/** Main stylisée : paume, doigts et pouce, selon la prise. */
function handShapes(sk: Skeleton, side: LimbSide, grip: Grip | undefined, far: boolean): Shape[] {
  const flag = far ? { far: true } : {};
  const wrist = sk.joints[`wrist${side}`];
  const s = sk.view === 'profil' || side === 'L' ? 1 : -1;
  const lateral = sk.view !== 'profil';
  const fore = sk.psi[`forearm${side}`];
  // Paume posée : poignet cassé à 90°, doigts vers l'avant ; sinon dans l'axe de l'avant-bras.
  const handPsi = grip === 'paume' ? fore + s * 90 : fore;
  const u = dir(handPsi);
  const n = { x: -u.y * s, y: u.x * s };
  // Paume posée : la main part du centre de la paume (au contact du support).
  const base = grip === 'paume' ? add(sk.joints[`hand${side}`], scale(u, -3.2)) : wrist;
  const at = (pts: [number, number][], origin = base) =>
    smoothClosed(placeLocal(origin, u, n, pts));
  if (grip === 'pronation' || grip === 'supination' || grip === 'neutre') {
    // Poing fermé autour de la barre ou de la poignée (centre de la paume).
    const c = sk.joints[`hand${side}`];
    const knuckles = grip === 'supination' ? -1 : 1;
    const fist: [number, number][] = [
      [-3.6, 3.4],
      [0.6, 4.4],
      [4.4, 3.2],
      [5.4, 0],
      [4.4, -3.4],
      [0.4, -4.4],
      [-3.4, -3.6],
      [-4.6, 0],
    ];
    const shapes: Shape[] = [{ d: at(fist, c), tone: 'skin', ...flag }];
    // Phalanges repliées, côté paume (lignes de doigts) ; pouce de l'autre côté.
    const fingerSide = -knuckles;
    for (const k of [-1.6, 0.6, 2.8]) {
      shapes.push({
        d: at(
          [
            [k - 0.5, fingerSide * 1.2],
            [k + 0.5, fingerSide * 1.2],
            [k + 0.4, fingerSide * 4.0],
            [k - 0.4, fingerSide * 4.0],
          ],
          c,
        ),
        tone: 'shade',
        ...flag,
      });
    }
    const thumb: [number, number][] =
      grip === 'neutre' || lateral
        ? [
            [-1.2, knuckles * 1.0],
            [3.4, knuckles * 1.8],
            [4.6, knuckles * 0.2],
            [0, -knuckles * 0.6],
          ]
        : [
            [-2.6, knuckles * 2.6],
            [1.8, knuckles * 4.6],
            [3.0, knuckles * 3.6],
            [-1.0, knuckles * 1.6],
          ];
    shapes.push({ d: at(thumb, c), tone: 'skinLine', ...flag });
    return shapes;
  }
  // Main ouverte : paume, doigts serrés, pouce détaché.
  const flat = grip === 'paume' || grip === 'plat';
  const palm: [number, number][] = flat
    ? [
        [0, 2.2],
        [4, 2.6],
        [8.4, 2.2],
        [12.6, 1.4],
        [13.8, 0],
        [12.6, -1.2],
        [8, -1.9],
        [3.6, -2.2],
        [0, -2.0],
      ]
    : [
        [0, 2.8],
        [3.6, 3.4],
        [7.4, 3.2],
        [11.6, 2.2],
        [12.8, 0.4],
        [11.8, -1.6],
        [7.4, -2.8],
        [3.4, -3.0],
        [0, -2.6],
      ];
  const thumbSide = lateral || flat ? 1 : -1;
  const thumbPts: [number, number][] = [
    [1.8, thumbSide * 2.2],
    [5.4, thumbSide * 4.4],
    [7.4, thumbSide * 4.2],
    [4.4, thumbSide * 1.6],
  ];
  return [
    { d: at(palm), tone: 'skin', ...flag },
    { d: at(thumbPts), tone: 'skinLine', ...flag },
    {
      d: at([
        [7.6, -0.3],
        [11.4, -0.4],
        [11.4, 0.3],
        [7.6, 0.4],
      ]),
      tone: 'shade',
      ...flag,
    },
  ];
}

function armShapes(
  sk: Skeleton,
  body: BodyShape,
  sil: Silhouette,
  side: LimbSide,
  far: boolean,
  muscles: readonly FigureMuscle[],
  grip: Grip | undefined,
): Shape[] {
  const out: Shape[] = [];
  const lateral = sk.view !== 'profil';
  const l = limbs(sk, sil, side);
  pushLimb(out, l.upperArm, { tone: 'top', to: body.outfit.sleeve }, far, muscles, lateral);
  pushLimb(out, l.forearm, null, far, [], lateral);
  out.push(...handShapes(sk, side, grip, far));
  return out;
}

function torsoShapes(
  sk: Skeleton,
  body: BodyShape,
  sil: Silhouette,
  muscles: readonly FigureMuscle[],
): Shape[] {
  const j = sk.joints;
  const axis = torsoAxis(j.pelvis, j.waist, j.neck);
  const prof = sil.torso;
  const first = prof.t[0] ?? -0.16;
  const last = prof.t[prof.t.length - 1] ?? 1.04;
  const lateral = sk.view !== 'profil';
  const neckTop = add(
    j.neck,
    scale(
      { x: Math.sin((sk.headTilt * Math.PI) / 180), y: Math.cos((sk.headTilt * Math.PI) / 180) },
      8,
    ),
  );
  const out: Shape[] = [
    {
      d: smoothClosed(
        segmentOutline(
          segmentAxis(
            add(
              j.neck,
              scale(
                {
                  x: Math.sin((sk.thoracicTilt * Math.PI) / 180),
                  y: Math.cos((sk.thoracicTilt * Math.PI) / 180),
                },
                -3,
              ),
            ),
            neckTop,
            -1,
          ),
          NECK,
          0,
          1,
        ),
      ),
      tone: 'skin',
    },
    { d: smoothClosed(segmentOutline(axis, prof, first, last)), tone: 'skin' },
    {
      d: smoothClosed(segmentOutline(axis, prof, first, body.outfit.bottomTo, 1.03)),
      tone: 'bottom',
    },
    {
      d: smoothClosed(segmentOutline(axis, prof, body.outfit.topFrom, Math.min(last, 1.0), 1.03)),
      tone: 'top',
    },
    {
      d: smoothClosed(
        sideLens(axis, prof, first + 0.04, last - 0.06, shadeSide(axis), 0.4, 1.02, 0.3),
      ),
      tone: 'shade',
    },
  ];
  for (const muscle of muscles) {
    for (const region of MUSCLE_REGIONS[muscle]) {
      if (region.part !== 'torso') continue;
      out.push({
        d: smoothClosed(
          sideLens(
            axis,
            prof,
            Math.max(region.from, first),
            region.to,
            lateral ? 'all' : region.side,
            -0.1,
            0.95,
            0.55,
          ),
        ),
        tone: 'highlight',
      });
    }
  }
  return out;
}

/** Formes du mannequin, dans l'ordre de dessin (du fond vers l'avant). */
export function drawFigure(
  sk: Skeleton,
  body: BodyShape,
  muscles: readonly FigureMuscle[],
  attach: Partial<
    Record<LimbSide, { readonly under: readonly Shape[]; readonly over: readonly Shape[] }>
  > = {},
  grip: Readonly<Partial<Record<LimbSide, Grip>>> = {},
): Shape[] {
  const lateral = sk.view !== 'profil';
  const underL = attach.L?.under ?? [];
  const overL = attach.L?.over ?? [];
  const underR = (attach.R?.under ?? []).map((shape) =>
    lateral ? shape : { ...shape, far: true },
  );
  const overR = (attach.R?.over ?? []).map((shape) => (lateral ? shape : { ...shape, far: true }));
  const sil = lateral ? body.face : body.profile;
  const head = headShapes(sk, body);
  if (lateral) {
    return [
      ...legShapes(sk, body, sil, 'R', false, muscles),
      ...legShapes(sk, body, sil, 'L', false, muscles),
      ...torsoShapes(sk, body, sil, muscles),
      ...head,
      ...underR,
      ...armShapes(sk, body, sil, 'R', false, muscles, grip.R),
      ...overR,
      ...underL,
      ...armShapes(sk, body, sil, 'L', false, muscles, grip.L),
      ...overL,
    ];
  }
  return [
    ...underR,
    ...armShapes(sk, body, sil, 'R', true, muscles, grip.R),
    ...overR,
    ...legShapes(sk, body, sil, 'R', true, muscles),
    ...torsoShapes(sk, body, sil, muscles),
    ...head,
    ...legShapes(sk, body, sil, 'L', false, muscles),
    ...underL,
    ...armShapes(sk, body, sil, 'L', false, muscles, grip.L),
    ...overL,
  ];
}

/** Épaisseur d'un profil (utile aux accessoires posés contre le corps). */
export function thickness(profile: WidthProfile, t: number): number {
  return widthAt(profile.front, profile.t, t) + widthAt(profile.back, profile.t, t);
}
