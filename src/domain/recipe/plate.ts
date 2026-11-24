import type { PlateBalance } from './recipe.types';

/** Parts usuelles d'une assiette, de la plus petite à la plus grande. */
const SHARES: readonly (readonly [number, string])[] = [
  [1 / 5, 'environ un cinquième'],
  [1 / 4, 'environ un quart'],
  [1 / 3, 'environ un tiers'],
  [1 / 2, 'environ la moitié'],
  [2 / 3, 'environ les deux tiers'],
  [3 / 4, 'environ les trois quarts'],
];

/**
 * Part d'une famille dans l'assiette, en mots (jamais en pourcentage) : « environ un quart ».
 * Texte lu par les lecteurs d'écran (ADR 0010).
 */
export function describePlateShare(share: number): string {
  if (share < 0.1) return 'une toute petite part';
  let best = SHARES[0] as (typeof SHARES)[number];
  for (const candidate of SHARES) {
    if (Math.abs(candidate[0] - share) < Math.abs(best[0] - share)) best = candidate;
  }
  if (Math.abs(best[0] - share) > 0.07)
    return share > 0.8 ? 'presque toute l’assiette' : 'une bonne part';
  return best[1];
}

/** « Légumes : environ la moitié de l’assiette, protéines : environ un quart… » */
export function describePlate(plate: PlateBalance): string {
  const parts: readonly (readonly [string, number])[] = [
    ['légumes', plate.vegetables],
    ['féculents', plate.starches],
    ['protéines', plate.proteins],
  ];
  return parts.map(([name, share]) => `${name} : ${describePlateShare(share)}`).join(', ');
}
