/**
 * Image complète d'une pose : décor, mannequin, charges, sol et ombre portée, dans un cadre
 * (viewBox) commun à toutes les poses d'un mouvement pour que rien ne saute pendant l'animation.
 */
import { BODIES } from './body';
import type { BodyId } from './body';
import { drawFigure } from './draw';
import type { Shape } from './draw';
import { loadShapes, resolveRef, sceneShapes } from './equipment';
import type { EquipmentKind, Load, Ref, SceneItem } from './equipment';
import type { MovementDef } from './library/types';
import type { FigureMuscle } from './muscles';
import { line, polygon } from './outline';
import { solvePose } from './rig';
import type { ContactPoint, Point, Pose, Skeleton } from './rig';
import { interpolatePose } from './timeline';

export interface FrameOptions {
  readonly body: BodyId;
  /** Muscles surlignés (ceux du mouvement par défaut). */
  readonly highlight?: readonly FigureMuscle[] | undefined;
  /** Matériel à montrer (celui du mouvement par défaut). */
  readonly equipment?: readonly EquipmentKind[] | undefined;
  /** Repères de mouvement (trajectoire, dos droit). */
  readonly guides?: boolean | undefined;
}

export interface ViewBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Rapport largeur / hauteur du cadre, borné : debout ≈ carré, allongé ≈ panoramique. */
const MIN_ASPECT = 0.95;
const MAX_ASPECT = 1.9;

/**
 * Scène et charges de la pose, limitées au matériel de l'exercice : on ne dessine jamais une
 * pièce que l'exercice n'utilise pas (le catalogue décide, pas la pose générique).
 */
export function equipmentFor(
  def: MovementDef,
  equipment: readonly EquipmentKind[] | undefined,
): { scene: SceneItem[]; loads: Load[] } {
  const scene = def.scene ?? [];
  const loads = def.loads ?? [];
  if (!equipment) return { scene: [...scene], loads: [...loads] };
  return {
    scene: scene.filter((item) => equipment.includes(item.equipment)),
    loads: loads.filter((load) => equipment.includes(load.kind)),
  };
}

export function skeletonFor(def: MovementDef, pose: Pose, body: BodyId): Skeleton {
  return solvePose(pose, def.view, BODIES[body].frame);
}

/** Formes d'une pose. */
export function frameShapes(
  def: MovementDef,
  pose: Pose,
  options: FrameOptions,
  box: ViewBox,
): Shape[] {
  const body = BODIES[options.body];
  const sk = skeletonFor(def, pose, options.body);
  const { scene, loads } = equipmentFor(def, options.equipment);
  const held = {
    back: [] as Shape[],
    L: { under: [] as Shape[], over: [] as Shape[] },
    R: { under: [] as Shape[], over: [] as Shape[] },
    front: [] as Shape[],
  };
  for (const load of loads) {
    const drawn = loadShapes(load, sk, body.frame.shoulderHalf);
    held.back.push(...drawn.back);
    for (const side of ['L', 'R'] as const) {
      held[side].under.push(...drawn[side].under);
      held[side].over.push(...drawn[side].over);
    }
    held.front.push(...drawn.front);
  }
  const shapes: Shape[] = [];
  if (def.view !== 'dessus') {
    shapes.push({
      d: line([
        { x: box.x, y: 0 },
        { x: box.x + box.width, y: 0 },
      ]),
      tone: 'ground',
    });
    shapes.push(shadow(sk));
  }
  shapes.push(...sceneShapes(scene, sk, false));
  shapes.push(...contactShapes(sk, pose));
  shapes.push(...held.back);
  if (options.guides) shapes.push(...backGuide(def, sk));
  shapes.push(...drawFigure(sk, body, options.highlight ?? def.muscles, held, pose.grip ?? {}));
  shapes.push(...held.front);
  shapes.push(...sceneShapes(scene, sk, true));
  if (options.guides) shapes.push(...pathGuide(def, options.body));
  return shapes;
}

/** Distance entre une articulation posée et son support. */
const CONTACT_GAP: Partial<Record<ContactPoint, number>> = {
  pelvis: 10.5,
  neck: 9,
  head: 10.5,
  kneeL: 5,
  kneeR: 5,
  handL: 2.6,
  handR: 2.6,
  elbowL: 4.2,
  elbowR: 4.2,
  ankleL: 3.5,
  ankleR: 3.5,
};

/** Marques d'appui : un léger halo sous chaque point de contact déclaré. */
function contactShapes(sk: Skeleton, pose: Pose): Shape[] {
  return (pose.contacts ?? []).flatMap((contact): Shape[] => {
    const side = contact.slice(-1) as 'L' | 'R';
    const grip = contact.startsWith('hand') ? pose.grip?.[side] : undefined;
    // Une main qui serre une barre ou une poignée se lit déjà par le poing.
    if (grip === 'pronation' || grip === 'supination' || grip === 'neutre') return [];
    const p = sk.joints[contact];
    const c = { x: p.x, y: p.y - (CONTACT_GAP[contact] ?? 0) };
    return [
      {
        d: ellipse(c, 5.6, 1.8),
        tone: 'contact',
        ...(sk.view === 'profil' && side === 'R' && contact !== 'pelvis' ? { far: true } : {}),
      },
    ];
  });
}

function ellipse(c: Point, rx: number, ry: number): string {
  const k = 0.5523;
  const p = (x: number, y: number) => `${(c.x + x).toFixed(1)} ${(-(c.y + y)).toFixed(1)}`;
  return (
    `M${p(-rx, 0)}C${p(-rx, ry * k)} ${p(-rx * k, ry)} ${p(0, ry)}` +
    `C${p(rx * k, ry)} ${p(rx, ry * k)} ${p(rx, 0)}` +
    `C${p(rx, -ry * k)} ${p(rx * k, -ry)} ${p(0, -ry)}` +
    `C${p(-rx * k, -ry)} ${p(-rx, -ry * k)} ${p(-rx, 0)}Z`
  );
}

/** Ligne pointillée parallèle au dos : le dos reste droit. */
function backGuide(def: MovementDef, sk: Skeleton): Shape[] {
  if (!def.guides?.back) return [];
  const t = (sk.lumbarTilt * Math.PI) / 180;
  const back = { x: -Math.cos(t), y: Math.sin(t) };
  const off = 15;
  const a = { x: sk.joints.pelvis.x + back.x * off, y: sk.joints.pelvis.y + back.y * off };
  const top = sk.joints.neck;
  const b = { x: top.x + back.x * off, y: top.y + back.y * off };
  const ext = { x: (b.x - a.x) * 0.12, y: (b.y - a.y) * 0.12 };
  return [
    {
      d: line([
        { x: a.x - ext.x, y: a.y - ext.y },
        { x: b.x + ext.x, y: b.y + ext.y },
      ]),
      tone: 'guide',
    },
  ];
}

/** Trajectoire de l'articulation suivie, du départ à l'arrivée, avec une pointe de flèche. */
function pathGuide(def: MovementDef, body: BodyId): Shape[] {
  const joint = def.guides?.path;
  if (!joint) return [];
  const frame = BODIES[body].frame;
  const keys = def.timeline.keys.map((k) => k.pose);
  const end = def.endIndex ?? keys.length - 1;
  const pts: Point[] = [];
  for (let i = 0; i < end; i += 1) {
    const a = keys[i];
    const b = keys[i + 1];
    if (!a || !b) continue;
    for (let k = 0; k <= 10; k += 1) {
      const p = interpolatePose(a, b, k / 10, def.view, frame);
      pts.push(solvePose(p, def.view, frame).joints[joint]);
    }
  }
  if (pts.length < 2) return [];
  // Décalée devant l'articulation pour ne pas se confondre avec le corps.
  const start = pts[0] as Point;
  const last = pts[pts.length - 1] as Point;
  const span = Math.hypot(last.x - start.x, last.y - start.y);
  if (span < 6) return [];
  const trimmed = pts.slice(1, -1);
  const tail = trimmed[trimmed.length - 1] ?? start;
  const ang = Math.atan2(last.y - tail.y, last.x - tail.x);
  const tip = { x: last.x, y: last.y };
  const head = [
    tip,
    { x: tip.x - Math.cos(ang - 0.45) * 5, y: tip.y - Math.sin(ang - 0.45) * 5 },
    { x: tip.x - Math.cos(ang + 0.45) * 5, y: tip.y - Math.sin(ang + 0.45) * 5 },
  ];
  return [
    { d: line(pts), tone: 'guide' },
    { d: polygon(head), tone: 'guideHead' },
  ];
}

function shadow(sk: Skeleton): Shape {
  const xs = Object.values(sk.joints).map((p) => p.x);
  const lowest = Object.values(sk.joints).filter((p) => p.y < 40);
  const pool = lowest.length > 0 ? lowest.map((p) => p.x) : xs;
  const min = Math.min(...pool) - 8;
  const max = Math.max(...pool) + 8;
  const cx = (min + max) / 2;
  const rx = Math.max((max - min) / 2, 12);
  const ry = 2.6;
  // Ellipse aplatie en quatre arcs de Bézier.
  const k = 0.5523;
  const p = (x: number, y: number) => `${(cx + x).toFixed(1)} ${(-y).toFixed(1)}`;
  return {
    d:
      `M${p(-rx, 0)}C${p(-rx, ry * k)} ${p(-rx * k, ry)} ${p(0, ry)}` +
      `C${p(rx * k, ry)} ${p(rx, ry * k)} ${p(rx, 0)}` +
      `C${p(rx, -ry * k)} ${p(rx * k, -ry)} ${p(0, -ry)}` +
      `C${p(-rx * k, -ry)} ${p(-rx, -ry * k)} ${p(-rx, 0)}Z`,
    tone: 'shadow',
  };
}

function propPoints(item: SceneItem, sk: Skeleton): Point[] {
  const p = item.prop;
  const at = (ref: Ref) => resolveRef(ref, sk);
  switch (p.kind) {
    case 'pad':
    case 'frame':
    case 'cable':
    case 'band':
      return [at(p.a), at(p.b)];
    case 'wheel':
    case 'ball': {
      const c = at(p.c);
      return [
        { x: c.x - p.r, y: c.y - p.r },
        { x: c.x + p.r, y: c.y + p.r },
      ];
    }
    case 'mat':
      return [
        { x: p.x0, y: 0 },
        { x: p.x1, y: 0 },
      ];
    case 'wall':
      return [
        { x: p.x, y: 0 },
        { x: p.x + p.side * 7, y: 0 },
      ];
    case 'box':
      return [
        { x: p.x0, y: 0 },
        { x: p.x1, y: p.h },
      ];
    case 'stack':
      return [
        { x: p.x - p.w / 2, y: p.y },
        { x: p.x + p.w / 2, y: p.y + p.h },
      ];
    case 'table':
      return [
        { x: p.x0, y: 0 },
        { x: p.x1, y: p.h },
      ];
    case 'anchor': {
      const c = at(p.at);
      return [
        { x: c.x, y: c.y + 9 },
        { x: c.x, y: c.y - 9 },
      ];
    }
    case 'bar': {
      const c = at(p.c);
      return [
        { x: c.x - 36, y: c.y + 9 },
        { x: c.x + 3, y: c.y },
      ];
    }
  }
}

/** Cadre commun à tout le mouvement (poses clés et intermédiaires) : même échelle partout. */
export function movementViewBox(def: MovementDef, body: BodyId): ViewBox {
  const frame = BODIES[body].frame;
  const keys = def.timeline.keys.map((k) => k.pose);
  const poses: Pose[] = [...keys];
  keys.forEach((a, i) => {
    const b = keys[(i + 1) % keys.length];
    if (b && b !== a) poses.push(interpolatePose(a, b, 0.5, def.view, frame));
  });
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const extend = (x: number, y: number, r: number) => {
    minX = Math.min(minX, x - r);
    maxX = Math.max(maxX, x + r);
    minY = Math.min(minY, y - r);
    maxY = Math.max(maxY, y + r);
  };
  const skeletons = poses.map((pose) => solvePose(pose, def.view, frame));
  for (const sk of skeletons) {
    for (const [name, p] of Object.entries(sk.joints)) {
      extend(p.x, p.y, name === 'head' ? 13 : 9);
    }
  }
  const hasPlate = (def.loads ?? []).some((l) => l.kind === 'barre' || l.kind === 'barre-ez');
  const hasBag = (def.loads ?? []).some((l) => l.kind === 'sac-a-dos');
  if (hasBag) minY -= 24;
  if (hasPlate) {
    minY -= 6;
    maxY += 10;
  }
  const bodyTop = maxY;
  for (const item of def.scene ?? []) {
    for (const sk of skeletons) {
      for (const pnt of propPoints(item, sk)) {
        if (item.prop.kind === 'wall' || item.prop.kind === 'mat') {
          // Murs et tapis peuvent déborder du cadre.
          extend(Math.max(Math.min(pnt.x, maxX + 6), minX - 6), Math.min(pnt.y, bodyTop), 1);
        } else {
          extend(pnt.x, pnt.y, 3);
        }
      }
    }
  }
  const grounded = def.view !== 'dessus';
  if (grounded) minY = Math.min(minY, -5);
  // Le mannequin occupe environ 85 % de la hauteur du cadre.
  let width = maxX - minX + 10;
  let height = (maxY - minY) / 0.92;
  if (width / height > MAX_ASPECT) height = width / MAX_ASPECT;
  if (width / height < MIN_ASPECT) width = height * MIN_ASPECT;
  const cx = (minX + maxX) / 2;
  // Le sol reste en bas du cadre ; l'espace en trop va au-dessus.
  const bottom = grounded ? -5 : (minY + maxY) / 2 - height / 2;
  return { x: cx - width / 2, y: -(bottom + height), width, height };
}
