/**
 * Source d'aléa injectée dans le domain : renvoie un nombre dans [0, 1).
 * L'application l'obtient du port `RandomSource` ; les tests utilisent `createSeededRng`.
 */
export type Rng = () => number;

/** Générateur pseudo-aléatoire déterministe (mulberry32) à partir d'une graine entière. */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Index aléatoire dans [0, length). `length` doit être ≥ 1. */
export function randomIndex(length: number, rng: Rng): number {
  return Math.min(length - 1, Math.floor(rng() * length));
}
