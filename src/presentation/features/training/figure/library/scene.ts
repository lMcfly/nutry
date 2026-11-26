/**
 * Pièces de décor prêtes à l'emploi, composées des formes simples de `equipment.ts`.
 * Chaque fonction renvoie des éléments de scène rattachés à leur type de matériel.
 */
import type { EquipmentKind, Ref, SceneItem } from '../equipment';
import type { JointName, Point } from '../rig';
import { pt } from './pose';

export const item = (
  equipment: EquipmentKind,
  prop: SceneItem['prop'],
  front = false,
): SceneItem => (front ? { equipment, prop, front } : { equipment, prop });

export const hand = (side: 'L' | 'R'): Ref => ({ joint: `hand${side}` as JointName });

/** Banc plat : coussin de `x0` à `x1`, dessus à `top`. */
export function bench(x0: number, x1: number, top: number): SceneItem[] {
  const legs = [x0 + 7, x1 - 7];
  return [
    ...legs.flatMap((x) => [
      item('banc', { kind: 'frame', a: pt(x, 0.8), b: pt(x, top - 4), r: 1.6 }),
      item('banc', { kind: 'frame', a: pt(x - 5, 0.8), b: pt(x + 5, 0.8), r: 0.9 }),
    ]),
    item('banc', { kind: 'frame', a: pt(x0 + 4, top - 6.5), b: pt(x1 - 4, top - 6.5), r: 1.2 }),
    item('banc', { kind: 'pad', a: pt(x0 + 3, top - 3), b: pt(x1 - 3, top - 3), r: 3 }),
  ];
}

/**
 * Banc incliné : assise horizontale vers `seatDir`, dossier qui remonte de `angle` degrés depuis
 * l'horizontale, côté opposé. `pivot` est le point bas du dossier (dessus du coussin).
 */
export function inclineBench(
  pivot: Point,
  angle: number,
  seatDir: 1 | -1,
  backLength = 58,
  seatLength = 30,
  equipment: EquipmentKind = 'banc-incline',
): SceneItem[] {
  const rad = (angle * Math.PI) / 180;
  const backEnd = pt(
    pivot.x - seatDir * Math.cos(rad) * backLength,
    pivot.y + Math.sin(rad) * backLength,
  );
  const seatEnd = pt(pivot.x + seatDir * seatLength, pivot.y);
  const normal = pt(seatDir * Math.sin(rad), -Math.cos(rad));
  const inset = (p: Point, k: number) => pt(p.x + normal.x * k, p.y + normal.y * k);
  return [
    item(equipment, {
      kind: 'frame',
      a: pt(pivot.x + seatDir * 6, 0.8),
      b: pt(pivot.x + seatDir * 6, pivot.y - 5),
      r: 1.6,
    }),
    item(equipment, {
      kind: 'frame',
      a: pt(pivot.x + seatDir * 6 - 12, 0.8),
      b: pt(pivot.x + seatDir * 6 + 12, 0.8),
      r: 0.9,
    }),
    item(equipment, { kind: 'frame', a: inset(pivot, 5), b: inset(backEnd, 5), r: 1.4 }),
    item(equipment, { kind: 'frame', a: inset(backEnd, 5), b: pt(backEnd.x, 0.8), r: 1.4 }),
    item(equipment, {
      kind: 'pad',
      a: pt(pivot.x + seatDir * 2, pivot.y - 3),
      b: pt(seatEnd.x - seatDir * 3, pivot.y - 3),
      r: 3,
    }),
    item(equipment, { kind: 'pad', a: inset(pivot, 3), b: inset(backEnd, 3), r: 3 }),
  ];
}

export const mat = (x0: number, x1: number): SceneItem[] => [
  item('tapis', { kind: 'mat', x0, x1 }),
];

/** Portique de traction vu de face : deux montants et une barre horizontale à `barY`. */
export const pullupFrame = (barY: number, half = 46): SceneItem[] => [
  item('barre-traction', { kind: 'frame', a: pt(-half, 0.8), b: pt(-half, barY + 3), r: 2.2 }),
  item('barre-traction', { kind: 'frame', a: pt(half, 0.8), b: pt(half, barY + 3), r: 2.2 }),
  item('barre-traction', { kind: 'frame', a: pt(-half - 8, 0.8), b: pt(-half + 8, 0.8), r: 1 }),
  item('barre-traction', { kind: 'frame', a: pt(half - 8, 0.8), b: pt(half + 8, 0.8), r: 1 }),
  item('barre-traction', { kind: 'frame', a: pt(-half - 2, barY), b: pt(half + 2, barY), r: 1.6 }),
];

/** Barre de traction vue en bout, sur sa potence. */
export const pullupBar = (at: Point, top: number): SceneItem[] => [
  item('barre-traction', { kind: 'bar', c: at, top }),
];

/** Colonne de poulie : montant, pile de plaques, poulie à `wheel`, câble vers `to`. */
export function pulley(
  columnX: number,
  wheel: Point,
  to: Ref,
  top = Math.max(wheel.y + 12, 120),
  equipment: EquipmentKind = 'poulie',
): SceneItem[] {
  return [
    item(equipment, { kind: 'frame', a: pt(columnX, 0.8), b: pt(columnX, top), r: 2.2 }),
    item(equipment, { kind: 'frame', a: pt(columnX - 9, 0.8), b: pt(columnX + 9, 0.8), r: 1 }),
    item(equipment, { kind: 'stack', x: columnX, y: 2, w: 13, h: 26 }),
    item(equipment, { kind: 'frame', a: pt(columnX, wheel.y), b: wheel, r: 1.2 }),
    item(equipment, { kind: 'wheel', c: wheel, r: 3.2 }),
    item(equipment, { kind: 'cable', a: wheel, b: to }, true),
  ];
}

export const band = (from: Ref, to: Ref): SceneItem[] => [
  item('elastique', { kind: 'band', a: from, b: to }, true),
];

export const wall = (x: number, side: 1 | -1, top = 190): SceneItem[] => [
  item('mur', { kind: 'wall', x, side, top }),
];

export const box = (
  x0: number,
  x1: number,
  h: number,
  equipment: EquipmentKind = 'step',
): SceneItem[] => [item(equipment, { kind: 'box', x0, x1, h })];

export const ball = (c: Point, r = 32): SceneItem[] => [item('swiss-ball', { kind: 'ball', c, r })];

/** Chaise vue de profil, assise de `x0` à `x1`, dossier côté `backSide`. */
export function chair(x0: number, x1: number, seat = 45, backSide: 1 | -1 = -1): SceneItem[] {
  const backX = backSide < 0 ? x0 + 2 : x1 - 2;
  return [
    item('chaise', { kind: 'frame', a: pt(x0 + 2, 0.8), b: pt(x0 + 2, seat - 2), r: 1.4 }),
    item('chaise', { kind: 'frame', a: pt(x1 - 2, 0.8), b: pt(x1 - 2, seat - 2), r: 1.4 }),
    item('chaise', {
      kind: 'frame',
      a: pt(backX, seat),
      b: pt(backX - backSide * 2, seat + 40),
      r: 1.4,
    }),
    item('chaise', {
      kind: 'pad',
      a: pt(backX - backSide * 1.6, seat + 22),
      b: pt(backX - backSide * 2, seat + 38),
      r: 2.4,
    }),
    item('chaise', {
      kind: 'pad',
      a: pt(x0 + 1.5, seat - 1.5),
      b: pt(x1 - 1.5, seat - 1.5),
      r: 1.8,
    }),
  ];
}

/** Pièces génériques d'une machine guidée. */
export const machine = {
  pad: (a: Ref, b: Ref, r = 3.2): SceneItem => item('machine', { kind: 'pad', a, b, r }),
  frame: (a: Ref, b: Ref, r = 1.8): SceneItem => item('machine', { kind: 'frame', a, b, r }),
  /** Bras mobile qui suit une articulation (poignée, rouleau). */
  arm: (pivot: Point, to: Ref, r = 1.8): SceneItem =>
    item('machine', { kind: 'frame', a: pivot, b: to, r }, true),
  roller: (at: Ref, r = 3.6): SceneItem => item('machine', { kind: 'wheel', c: at, r }, true),
  stack: (x: number, h = 30): SceneItem => item('machine', { kind: 'stack', x, y: 2, w: 14, h }),
  cable: (a: Ref, b: Ref): SceneItem => item('machine', { kind: 'cable', a, b }, true),
  wheel: (c: Point, r = 3.2): SceneItem => item('machine', { kind: 'wheel', c, r }),
};

/** Table ou plan de travail, vu de profil : plateau de `x0` à `x1`, dessus à `h`. */
export const table = (x0: number, x1: number, h: number): SceneItem[] => [
  item('table', { kind: 'table', x0, x1, h }),
];

/** Point d'ancrage d'un élastique (porte, montant) à `at`. */
export const anchorAt = (at: Ref): SceneItem[] => [item('elastique', { kind: 'anchor', at })];

/** Change le type de matériel de pièces déjà composées (même dessin, autre matériel). */
export const retag = (
  items: readonly SceneItem[],
  from: EquipmentKind,
  to: EquipmentKind,
): SceneItem[] => items.map((it) => (it.equipment === from ? { ...it, equipment: to } : it));
