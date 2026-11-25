/**
 * Morphologies du mannequin, séparées des poses : les mêmes poses servent aux deux corps.
 *
 * Chaque segment est décrit par un profil de demi-épaisseurs le long de son axe (t = 0 à
 * l'articulation proximale, t = 1 à l'articulation distale), côté « avant » et côté
 * « arrière » (vue de profil) ou côté extérieur et intérieur (vue de face). Les contours sont
 * ensuite lissés en courbes de Bézier (`outline.ts`).
 */
import type { Frame } from './rig';

export type BodyId = 'female' | 'male';

export interface WidthProfile {
  readonly t: readonly number[];
  readonly front: readonly number[];
  readonly back: readonly number[];
}

export interface Silhouette {
  readonly torso: WidthProfile;
  readonly thigh: WidthProfile;
  readonly shin: WidthProfile;
  readonly upperArm: WidthProfile;
  readonly forearm: WidthProfile;
}

export interface Outfit {
  /** Le haut couvre le tronc à partir de cette position (t du tronc). */
  readonly topFrom: number;
  /** Part du bras couverte par la manche (0 : débardeur). */
  readonly sleeve: number;
  /** Le bas couvre le tronc jusqu'à cette position. */
  readonly bottomTo: number;
  /** Part de la cuisse et de la jambe couvertes (short : cuisse partielle ; legging : tout). */
  readonly thigh: number;
  readonly shin: number;
}

export interface BodyShape {
  readonly id: BodyId;
  readonly frame: Frame;
  readonly profile: Silhouette;
  readonly face: Silhouette;
  readonly outfit: Outfit;
  readonly hair: 'court' | 'chignon';
}

const p = (t: number[], front: number[], back: number[]): WidthProfile => ({ t, front, back });

const MALE: BodyShape = {
  id: 'male',
  frame: { shoulderHalf: 15.5, hipHalf: 8.5 },
  profile: {
    // Bassin (fessiers derrière), taille, cage thoracique, base du cou.
    torso: p(
      [-0.12, -0.03, 0.08, 0.22, 0.38, 0.55, 0.7, 0.84, 0.95, 1.04],
      [6.5, 8.8, 9.6, 9.2, 9.0, 10.4, 11.6, 11.2, 9.0, 5.2],
      [8.2, 10.4, 10.6, 9.0, 8.4, 9.2, 10.4, 10.4, 8.8, 5.0],
    ),
    thigh: p(
      [0, 0.12, 0.35, 0.65, 0.88, 1],
      [8.0, 8.6, 8.2, 7.0, 5.6, 5.1],
      [8.6, 8.8, 7.8, 6.6, 5.6, 5.0],
    ),
    shin: p(
      [0, 0.18, 0.38, 0.65, 0.9, 1],
      [5.0, 4.9, 4.6, 3.9, 3.2, 3.1],
      [5.0, 6.3, 6.0, 4.4, 3.3, 3.1],
    ),
    upperArm: p([0, 0.18, 0.45, 0.75, 1], [6.6, 5.9, 5.4, 4.7, 4.1], [6.6, 6.2, 5.5, 4.7, 4.1]),
    forearm: p([0, 0.25, 0.55, 0.85, 1], [4.1, 4.4, 3.7, 3.0, 2.8], [4.1, 4.6, 4.0, 3.1, 2.8]),
  },
  face: {
    torso: p(
      [-0.16, -0.04, 0.1, 0.3, 0.5, 0.68, 0.82, 0.93, 1.04],
      [9, 13, 13.4, 12.2, 12.8, 14.6, 16, 15.2, 5.4],
      [9, 13, 13.4, 12.2, 12.8, 14.6, 16, 15.2, 5.4],
    ),
    thigh: p([0, 0.15, 0.5, 0.85, 1], [7.8, 8.4, 7.2, 5.6, 5.0], [7.0, 7.4, 6.4, 5.2, 5.0]),
    shin: p([0, 0.2, 0.45, 0.8, 1], [5.0, 5.8, 5.0, 3.4, 3.0], [5.0, 5.6, 4.8, 3.4, 3.0]),
    upperArm: p([0, 0.18, 0.5, 1], [7.3, 6.2, 5.3, 4.1], [5.9, 5.5, 4.8, 4.1]),
    forearm: p([0, 0.3, 0.8, 1], [4.2, 4.5, 3.2, 2.9], [4.0, 4.2, 3.1, 2.9]),
  },
  outfit: { topFrom: 0.1, sleeve: 0.42, bottomTo: 0.14, thigh: 0.5, shin: 0 },
  hair: 'court',
};

const FEMALE: BodyShape = {
  id: 'female',
  frame: { shoulderHalf: 13.8, hipHalf: 9.6 },
  profile: {
    torso: p(
      [-0.12, -0.03, 0.08, 0.22, 0.38, 0.55, 0.68, 0.8, 0.95, 1.04],
      [6.5, 8.6, 9.2, 8.4, 7.8, 9.0, 12.0, 11.0, 8.2, 4.8],
      [8.4, 10.6, 11.0, 9.2, 7.8, 8.4, 9.2, 9.4, 8.0, 4.6],
    ),
    thigh: p(
      [0, 0.12, 0.35, 0.65, 0.88, 1],
      [8.4, 8.8, 8.0, 6.6, 5.2, 4.8],
      [9.2, 9.2, 7.9, 6.4, 5.2, 4.7],
    ),
    shin: p(
      [0, 0.18, 0.38, 0.65, 0.9, 1],
      [4.7, 4.6, 4.3, 3.6, 2.9, 2.8],
      [4.7, 5.9, 5.6, 4.0, 3.0, 2.8],
    ),
    upperArm: p([0, 0.18, 0.45, 0.75, 1], [5.7, 5.1, 4.6, 4.1, 3.6], [5.7, 5.3, 4.7, 4.2, 3.6]),
    forearm: p([0, 0.25, 0.55, 0.85, 1], [3.6, 3.9, 3.3, 2.6, 2.4], [3.6, 4.1, 3.5, 2.8, 2.4]),
  },
  face: {
    torso: p(
      [-0.16, -0.04, 0.1, 0.3, 0.5, 0.68, 0.82, 0.93, 1.04],
      [10, 14.6, 14.8, 12.4, 11.0, 12.8, 13.8, 13.4, 5.0],
      [10, 14.6, 14.8, 12.4, 11.0, 12.8, 13.8, 13.4, 5.0],
    ),
    thigh: p([0, 0.15, 0.5, 0.85, 1], [8.4, 8.8, 7.2, 5.4, 4.8], [7.4, 7.6, 6.4, 5.0, 4.7]),
    shin: p([0, 0.2, 0.45, 0.8, 1], [4.7, 5.4, 4.6, 3.2, 2.8], [4.7, 5.2, 4.4, 3.2, 2.8]),
    upperArm: p([0, 0.18, 0.5, 1], [6.2, 5.3, 4.6, 3.6], [5.3, 4.8, 4.4, 3.6]),
    forearm: p([0, 0.3, 0.8, 1], [3.7, 4.0, 2.9, 2.5], [3.5, 3.7, 2.8, 2.5]),
  },
  // Brassière longue et legging 7/8.
  outfit: { topFrom: 0.42, sleeve: 0, bottomTo: 0.36, thigh: 1, shin: 0.82 },
  hair: 'chignon',
};

export const BODIES: Readonly<Record<BodyId, BodyShape>> = { male: MALE, female: FEMALE };

/** Demi-épaisseur interpolée d'un profil à la position t. */
export function widthAt(values: readonly number[], ts: readonly number[], t: number): number {
  const first = ts[0] ?? 0;
  if (t <= first) return values[0] ?? 0;
  for (let i = 1; i < ts.length; i += 1) {
    const t1 = ts[i] ?? 0;
    if (t <= t1) {
      const t0 = ts[i - 1] ?? 0;
      const v0 = values[i - 1] ?? 0;
      const v1 = values[i] ?? 0;
      const k = (t - t0) / (t1 - t0 || 1);
      // Interpolation cosinus : épaisseurs galbées, sans angle.
      return v0 + (v1 - v0) * (0.5 - 0.5 * Math.cos(Math.PI * k));
    }
  }
  return values[values.length - 1] ?? 0;
}
