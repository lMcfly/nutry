import { addDays, daysBetween, startOfWeek } from '../shared';
import type { IsoDate } from '../shared';
import type { ProgressEntry, ProgressMetric } from './progress.types';

export type EntryCheck =
  | { readonly status: 'nouvelle' }
  | { readonly status: 'correction' }
  | { readonly status: 'refusee'; readonly message: string; readonly nextAllowedDate: IsoDate }
  | { readonly status: 'invalide'; readonly message: string };

/**
 * Règle « une fois par semaine » : une mesure par semaine calendaire (lundi → dimanche),
 * plus lisible pour l'utilisateur qu'un délai glissant de 7 jours (« rendez-vous lundi »).
 * Une nouvelle saisie à la même date corrige la précédente.
 */
export function checkProgressEntry(
  entries: readonly ProgressEntry[],
  entry: ProgressEntry,
  today: IsoDate,
): EntryCheck {
  const values = [entry.weightKg, entry.waistCm].filter((v) => v !== undefined);
  if (values.length === 0 || values.some((v) => !Number.isFinite(v) || v <= 0)) {
    return { status: 'invalide', message: 'Indique au moins une mesure supérieure à zéro.' };
  }
  if (daysBetween(today, entry.date) > 0) {
    return { status: 'invalide', message: 'Cette date n’est pas encore arrivée.' };
  }
  if (entries.some((e) => e.date === entry.date)) return { status: 'correction' };
  const week = startOfWeek(entry.date);
  if (entries.some((e) => startOfWeek(e.date) === week)) {
    return {
      status: 'refusee',
      message:
        'Tu as déjà fait le point cette semaine. Rendez-vous lundi prochain, sans pression !',
      nextAllowedDate: addDays(week, 7),
    };
  }
  return { status: 'nouvelle' };
}

/** Enregistre la mesure si elle est acceptée ; renvoie les mesures triées par date. */
export function recordProgress(
  entries: readonly ProgressEntry[],
  entry: ProgressEntry,
  today: IsoDate,
): { readonly check: EntryCheck; readonly entries: readonly ProgressEntry[] } {
  const check = checkProgressEntry(entries, entry, today);
  if (check.status === 'refusee' || check.status === 'invalide') return { check, entries };
  const next = [...entries.filter((e) => e.date !== entry.date), entry].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  return { check, entries: next };
}

export interface TrendPoint {
  readonly date: IsoDate;
  readonly value: number;
  /** Valeur lissée. */
  readonly trend: number;
}

/** Coefficient du lissage exponentiel : 0,4 donne une courbe calme sur des mesures hebdomadaires. */
export const TREND_SMOOTHING = 0.4;

/**
 * Tendance lissée (lissage exponentiel) d'une mesure, en ignorant les semaines sans valeur :
 * t₀ = x₀, tₙ = α·xₙ + (1 − α)·tₙ₋₁.
 */
export function computeTrend(
  entries: readonly ProgressEntry[],
  metric: ProgressMetric,
  alpha = TREND_SMOOTHING,
): TrendPoint[] {
  const points: TrendPoint[] = [];
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  for (const entry of sorted) {
    const value = entry[metric];
    if (value === undefined) continue;
    const previous = points.at(-1);
    const trend = previous ? alpha * value + (1 - alpha) * previous.trend : value;
    points.push({ date: entry.date, value, trend });
  }
  return points;
}

export interface ProgressSummary {
  /** Nombre de semaines avec au moins une mesure. */
  readonly weeksTracked: number;
  /** Semaines consécutives suivies, jusqu'à cette semaine ou la précédente. */
  readonly currentStreakWeeks: number;
  /** Message valorisant la régularité (jamais le chiffre). */
  readonly message: string;
}

export function summarizeProgress(
  entries: readonly ProgressEntry[],
  today: IsoDate,
): ProgressSummary {
  const weeks = new Set(entries.map((e) => startOfWeek(e.date)));
  let cursor = startOfWeek(today);
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return {
    weeksTracked: weeks.size,
    currentStreakWeeks: streak,
    message: progressMessage(weeks.size, streak),
  };
}

function progressMessage(weeksTracked: number, streak: number): string {
  if (weeksTracked === 0) {
    return 'Quand tu veux, tu peux noter un point d’étape : une fois par semaine suffit largement.';
  }
  if (weeksTracked === 1) return 'Premier point d’étape noté : bravo de prendre ce temps pour toi.';
  if (streak >= 3) return `${streak} semaines d’affilée : ta régularité est une vraie force.`;
  return `${weeksTracked} semaines suivies : chaque point d’étape compte, à ton rythme.`;
}
