/**
 * Géométrie des contours : axes de segments, contours galbés à partir de profils d'épaisseur,
 * lissage Catmull-Rom → courbes de Bézier cubiques. Coordonnées monde (y vers le haut) en
 * entrée, chemins SVG (y vers le bas) en sortie.
 */
import { widthAt } from './body';
import type { WidthProfile } from './body';
import { add, scale, sub } from './rig';
import type { Point } from './rig';

const fmt = (n: number): string => (Math.round(n * 10) / 10).toString();
const svg = (p: Point): string => `${fmt(p.x)} ${fmt(-p.y)}`;

/** Chemin fermé lisse passant par tous les points (Catmull-Rom uniforme). */
export function smoothClosed(points: readonly Point[]): string {
  const n = points.length;
  if (n < 3) return '';
  const at = (i: number): Point => points[((i % n) + n) % n] as Point;
  let d = `M${svg(at(0))}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = add(p1, scale(sub(p2, p0), 1 / 6));
    const c2 = sub(p2, scale(sub(p3, p1), 1 / 6));
    d += `C${svg(c1)} ${svg(c2)} ${svg(p2)}`;
  }
  return `${d}Z`;
}

/** Polygone à bords droits (accessoires). */
export function polygon(points: readonly Point[]): string {
  return `${points.map((p, i) => `${i === 0 ? 'M' : 'L'}${svg(p)}`).join('')}Z`;
}

/** Cercle en deux arcs. */
export function circle(c: Point, r: number): string {
  return `M${fmt(c.x - r)} ${fmt(-c.y)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(2 * r)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-2 * r)} 0Z`;
}

/** Trait (pour câbles et filets), à tracer avec un contour. */
export function line(points: readonly Point[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${svg(p)}`).join('');
}

/** Rectangle arrondi orienté de `a` à `b`, d'épaisseur 2r (capsule). */
export function capsule(a: Point, b: Point, r: number): string {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const n = { x: -u.y, y: u.x };
  const p1 = add(a, scale(n, r));
  const p2 = add(b, scale(n, r));
  const p3 = sub(b, scale(n, r));
  const p4 = sub(a, scale(n, r));
  return `M${svg(p1)}L${svg(p2)}A${fmt(r)} ${fmt(r)} 0 0 0 ${svg(p3)}L${svg(p4)}A${fmt(r)} ${fmt(r)} 0 0 0 ${svg(p1)}Z`;
}

export interface Axis {
  at(t: number): Point;
  /** Direction de l'axe (unitaire). */
  tangent(t: number): Point;
  /** Normale « avant » (ou extérieure en vue de face), unitaire. */
  normal(t: number): Point;
}

const unit = (v: Point): Point => {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
};

/** Axe droit de `a` à `b` ; la normale avant est la tangente tournée de 90° (sens `frontSign`). */
export function segmentAxis(a: Point, b: Point, frontSign: 1 | -1): Axis {
  const u = unit(sub(b, a));
  const n = { x: -u.y * frontSign, y: u.x * frontSign };
  return {
    at: (t) => add(a, scale(sub(b, a), t)),
    tangent: () => u,
    normal: () => n,
  };
}

/** Axe du tronc : bassin → taille → base du cou, normale avant lissée à la taille. */
export function torsoAxis(pelvis: Point, waist: Point, neck: Point): Axis {
  const d1 = unit(sub(waist, pelvis));
  const d2 = unit(sub(neck, waist));
  const tangent = (t: number): Point => {
    const k = Math.min(Math.max((t - 0.3) / 0.4, 0), 1);
    const w = k * k * (3 - 2 * k);
    return unit({ x: d1.x + (d2.x - d1.x) * w, y: d1.y + (d2.y - d1.y) * w });
  };
  return {
    at: (t) =>
      t < 0.5
        ? add(pelvis, scale(sub(waist, pelvis), t / 0.5))
        : add(waist, scale(sub(neck, waist), (t - 0.5) / 0.5)),
    tangent,
    normal: (t) => {
      const d = tangent(t);
      return { x: d.y, y: -d.x };
    },
  };
}

function samples(profile: WidthProfile, from: number, to: number): number[] {
  const ts = [from, ...profile.t.filter((t) => t > from && t < to), to];
  const out: number[] = [];
  ts.forEach((t, i) => {
    const next = ts[i + 1];
    out.push(t);
    if (next !== undefined && next - t > 0.18) out.push((t + next) / 2);
  });
  return out;
}

/** Contour d'une portion [from, to] d'un segment, avec bouts arrondis aux extrémités. */
export function segmentOutline(
  axis: Axis,
  profile: WidthProfile,
  from: number,
  to: number,
  widen = 1,
): Point[] {
  const first = profile.t[0] ?? 0;
  const last = profile.t[profile.t.length - 1] ?? 1;
  const ts = samples(profile, from, to);
  const front = (t: number) => widthAt(profile.front, profile.t, t) * widen;
  const back = (t: number) => widthAt(profile.back, profile.t, t) * widen;
  const pts: Point[] = ts.map((t) => add(axis.at(t), scale(axis.normal(t), front(t))));
  if (to >= last) {
    const c = axis.at(to);
    const u = axis.tangent(to);
    const n = axis.normal(to);
    const rf = front(to);
    const rb = back(to);
    for (const deg of [35, 70, 110, 145]) {
      const a = (deg * Math.PI) / 180;
      const r = deg < 90 ? rf : rb;
      pts.push(add(c, add(scale(n, Math.cos(a) * r), scale(u, Math.sin(a) * ((rf + rb) / 2)))));
    }
  }
  for (const t of [...ts].reverse()) pts.push(sub(axis.at(t), scale(axis.normal(t), back(t))));
  if (from <= first) {
    const c = axis.at(from);
    const u = axis.tangent(from);
    const n = axis.normal(from);
    const rf = front(from);
    const rb = back(from);
    for (const deg of [35, 70, 110, 145]) {
      const a = (deg * Math.PI) / 180;
      const r = deg < 90 ? rb : rf;
      pts.push(sub(c, add(scale(n, Math.cos(a) * r), scale(u, Math.sin(a) * ((rf + rb) / 2)))));
    }
  }
  return pts;
}

/**
 * Lentille posée sur un côté d'un segment (ombre, muscle) : de `inner` à `outer` fois
 * l'épaisseur, avec une enveloppe qui s'amincit aux deux bouts.
 */
export function sideLens(
  axis: Axis,
  profile: WidthProfile,
  from: number,
  to: number,
  side: 'front' | 'back' | 'all',
  inner: number,
  outer: number,
  taper = 0.6,
): Point[] {
  const count = 9;
  const ts = Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
  const env = (t: number) => Math.pow(Math.sin((Math.PI * (t - from)) / (to - from || 1)), taper);
  const width = (t: number, which: 'front' | 'back') =>
    widthAt(which === 'front' ? profile.front : profile.back, profile.t, t);
  if (side === 'all') {
    const top = ts.map((t) =>
      add(axis.at(t), scale(axis.normal(t), width(t, 'front') * outer * (0.35 + 0.65 * env(t)))),
    );
    const bottom = [...ts]
      .reverse()
      .map((t) =>
        sub(axis.at(t), scale(axis.normal(t), width(t, 'back') * outer * (0.35 + 0.65 * env(t)))),
      );
    return [...top, ...bottom];
  }
  const sign = side === 'front' ? 1 : -1;
  const edge = ts.map((t) =>
    add(axis.at(t), scale(axis.normal(t), sign * width(t, side) * outer * env(t))),
  );
  const base = [...ts]
    .reverse()
    .map((t) => add(axis.at(t), scale(axis.normal(t), sign * width(t, side) * inner * env(t))));
  return [...edge, ...base];
}

/** Points d'un gabarit local (x le long de `u`, y le long de `n`) placés autour de `origin`. */
export function placeLocal(
  origin: Point,
  u: Point,
  n: Point,
  local: readonly (readonly [number, number])[],
): Point[] {
  return local.map(([x, y]) => add(origin, add(scale(u, x), scale(n, y))));
}
