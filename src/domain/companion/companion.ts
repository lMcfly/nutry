import { daysBetween } from '../shared';
import type { IsoDate } from '../shared';
import {
  COMPANION_ACCESSORIES,
  COMPANION_COLORS,
  COMPANION_EYES,
  COMPANION_MESSAGES,
} from './companion.constants';
import { ACCESSORY_SLOTS } from './companion.types';
import type {
  CompanionItem,
  CompanionLook,
  CompanionMood,
  CompanionState,
  EquipResult,
  NextUnlock,
} from './companion.types';

/** Tout le catalogue, dans l'ordre : teintes, yeux, accessoires par seuil croissant. */
export const COMPANION_CATALOG: readonly CompanionItem[] = [
  ...COMPANION_COLORS,
  ...COMPANION_EYES,
  ...COMPANION_ACCESSORIES,
];

/**
 * Enregistre un geste (quiz, avis sur un repas, article coché) le jour local `day`.
 * - même jour : état inchangé (même référence) ;
 * - lendemain du dernier jour actif : la série continue ;
 * - jour manqué : la série repart à 1 ; le record et les déblocages restent acquis ;
 * - jour antérieur au dernier jour actif (horloge reculée) : ignoré.
 */
export function recordActivity(state: CompanionState, day: IsoDate): CompanionState {
  const last = state.lastActiveDay;
  if (last !== undefined) {
    const gap = daysBetween(last, day);
    if (gap <= 0) return state;
    const streak = gap === 1 ? state.streak + 1 : 1;
    return { ...state, lastActiveDay: day, streak, best: Math.max(state.best, streak) };
  }
  return { ...state, lastActiveDay: day, streak: 1, best: Math.max(state.best, 1) };
}

/** Série en cours : 0 si au moins un jour entier a été manqué depuis le dernier geste. */
export function currentStreak(state: CompanionState, today: IsoDate): number {
  if (state.lastActiveDay === undefined) return 0;
  return daysBetween(state.lastActiveDay, today) <= 1 ? state.streak : 0;
}

/**
 * Humeur : 'joyeux' si actif aujourd'hui, 'content' si actif hier (série en cours),
 * 'sieste' si la série est interrompue. Avant tout geste : 'content' (accueil).
 */
export function moodOf(state: CompanionState, today: IsoDate): CompanionMood {
  if (state.lastActiveDay === undefined) return 'content';
  const gap = daysBetween(state.lastActiveDay, today);
  if (gap <= 0) return 'joyeux';
  return gap === 1 ? 'content' : 'sieste';
}

/** Message bienveillant associé à l'humeur. */
export function companionMessage(state: CompanionState, today: IsoDate): string {
  if (state.lastActiveDay === undefined) return COMPANION_MESSAGES.welcome;
  const mood = moodOf(state, today);
  if (mood === 'joyeux') {
    return state.streak > 1
      ? COMPANION_MESSAGES.joyeux(state.streak)
      : COMPANION_MESSAGES.joyeuxFirst;
  }
  return mood === 'content' ? COMPANION_MESSAGES.content : COMPANION_MESSAGES.sieste(state.best);
}

/** Éléments débloqués, d'après le RECORD de série (rien ne se reperd). */
export function unlockedItems(state: CompanionState): readonly CompanionItem[] {
  return COMPANION_CATALOG.filter((item) => item.unlockAt <= state.best);
}

/**
 * Éléments débloqués depuis le dernier acquittement (`acknowledgeUnlocks`) : l'UI les
 * célèbre une fois.
 */
export function newlyUnlockedItems(state: CompanionState): readonly CompanionItem[] {
  return COMPANION_CATALOG.filter(
    (item) => item.unlockAt > state.acknowledgedBest && item.unlockAt <= state.best,
  );
}

/** Marque les déblocages actuels comme vus. */
export function acknowledge(state: CompanionState): CompanionState {
  return state.acknowledgedBest === state.best ? state : { ...state, acknowledgedBest: state.best };
}

/**
 * Prochain déblocage (seuil au-dessus du record) et jours de série encore nécessaires :
 * `inDays` compte depuis la série en cours (après une interruption, il faut repartir de 0).
 */
export function nextUnlock(state: CompanionState, today: IsoDate): NextUnlock | undefined {
  const upcoming = COMPANION_CATALOG.filter((item) => item.unlockAt > state.best).sort(
    (a, b) => a.unlockAt - b.unlockAt,
  )[0];
  if (!upcoming) return undefined;
  return { item: upcoming, inDays: upcoming.unlockAt - currentStreak(state, today) };
}

function findItem(kind: CompanionItem['kind'], id: string): CompanionItem | undefined {
  return COMPANION_CATALOG.find((item) => item.kind === kind && item.id === id);
}

/**
 * Applique une apparence. Refuse (sans rien changer) un élément inconnu, un accessoire
 * rangé dans le mauvais emplacement ou un élément non débloqué.
 */
export function equip(state: CompanionState, look: CompanionLook): EquipResult {
  const chosen: { kind: CompanionItem['kind']; id: string }[] = [
    { kind: 'color', id: look.color },
    { kind: 'eyes', id: look.eyes },
  ];
  for (const slot of ACCESSORY_SLOTS) {
    const id = look.accessories[slot];
    if (id === undefined) continue;
    const accessory = findItem('accessory', id);
    if (accessory?.kind !== 'accessory' || accessory.slot !== slot) {
      return { ok: false, reason: 'unknown', id };
    }
    chosen.push({ kind: 'accessory', id });
  }
  for (const { kind, id } of chosen) {
    const item = findItem(kind, id);
    if (!item) return { ok: false, reason: 'unknown', id };
    if (item.unlockAt > state.best) return { ok: false, reason: 'locked', item };
  }
  return { ok: true, state: { ...state, look: normalizeLook(look) } };
}

/** Copie propre : seules les clés connues, sans emplacement vide. */
function normalizeLook(look: CompanionLook): CompanionLook {
  const accessories: Record<string, string> = {};
  for (const slot of ACCESSORY_SLOTS) {
    const id = look.accessories[slot];
    if (id !== undefined) accessories[slot] = id;
  }
  return {
    color: look.color,
    eyes: look.eyes,
    accessories,
  };
}
