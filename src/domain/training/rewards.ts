import type { SessionLog } from './training.types';

/**
 * Accessoires sportifs de Nutry, débloqués par le nombre CUMULÉ de séances terminées (ADR 0015,
 * décision 2) : dérivé des journaux, donc rien ne se reperd. L'intégration au catalogue du
 * compagnon (`unlockAt`) et les dessins relèvent de la phase 5 ; ce module fixe les seuils.
 */
export interface SportAccessoryUnlock {
  readonly id: 'bandeau' | 'serviette' | 'casquette' | 'medaille';
  /** Emplacement porté par Nutry. */
  readonly slot: 'tete' | 'cou';
  readonly label: string;
  /** Nombre cumulé de séances terminées qui le débloque. */
  readonly sessions: number;
}

export const SPORT_ACCESSORY_UNLOCKS: readonly SportAccessoryUnlock[] = [
  { id: 'bandeau', slot: 'tete', label: 'Bandeau', sessions: 1 },
  { id: 'serviette', slot: 'cou', label: 'Serviette', sessions: 5 },
  { id: 'casquette', slot: 'tete', label: 'Casquette', sessions: 10 },
  { id: 'medaille', slot: 'cou', label: 'Médaille', sessions: 20 },
];

/** Séances terminées, toutes semaines confondues (une par journal `terminee`). */
export function completedSessionCount(logs: readonly SessionLog[]): number {
  return logs.filter((log) => log.status === 'terminee').length;
}

/** Accessoires débloqués à `count` séances terminées. */
export function unlockedSportAccessories(count: number): readonly SportAccessoryUnlock[] {
  return SPORT_ACCESSORY_UNLOCKS.filter((item) => item.sessions <= count);
}

/** Accessoires qu'une séance de plus fait passer de `before` à `after` séances terminées. */
export function newSportAccessories(
  before: number,
  after: number,
): readonly SportAccessoryUnlock[] {
  return SPORT_ACCESSORY_UNLOCKS.filter((item) => item.sessions > before && item.sessions <= after);
}

/** Prochain accessoire et nombre de séances restantes ; `undefined` quand tout est débloqué. */
export function nextSportAccessory(
  count: number,
): { readonly accessory: SportAccessoryUnlock; readonly remaining: number } | undefined {
  const accessory = SPORT_ACCESSORY_UNLOCKS.find((item) => item.sessions > count);
  return accessory === undefined ? undefined : { accessory, remaining: accessory.sessions - count };
}
