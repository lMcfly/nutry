import { addDays, daysBetween, startOfWeek } from '../shared';
import type { IsoDate } from '../shared';
import type { ProgressEntry, ProgressMetric } from './progress.types';

export type EntryCheck =
  | { readonly status: 'created' }
  /** Le point d'étape de la semaine existait : complété ou corrigé champ par champ. */
  | { readonly status: 'updated' }
  | { readonly status: 'invalide'; readonly message: string };

/**
 * Règle « une fois par semaine » : un point d'étape par semaine calendaire (lundi →
 * dimanche), plus lisible qu'un délai glissant de 7 jours. Une nouvelle saisie dans une
 * semaine déjà suivie ne crée pas de 2e mesure : elle complète ou corrige celle-ci.
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
  return sameWeek(entries, entry.date) ? { status: 'updated' } : { status: 'created' };
}

/** Mesure la plus récente de la semaine de `date`, s'il y en a une. */
function sameWeek(entries: readonly ProgressEntry[], date: IsoDate): ProgressEntry | undefined {
  const week = startOfWeek(date);
  return entries
    .filter((e) => startOfWeek(e.date) === week)
    .reduce<ProgressEntry | undefined>((a, e) => (a && a.date >= e.date ? a : e), undefined);
}

export interface RecordedProgress {
  readonly check: EntryCheck;
  /** Mesures triées par date (inchangées si la saisie est invalide). */
  readonly entries: readonly ProgressEntry[];
  /** Mesure à enregistrer (fusionnée avec celle de la semaine le cas échéant). */
  readonly saved?: ProgressEntry;
  /** Date de la mesure remplacée, si elle diffère de `saved.date` (à supprimer). */
  readonly replacedDate?: IsoDate;
}

/**
 * Enregistre la saisie. Dans une semaine déjà suivie, FUSION champ par champ : les champs
 * saisis remplacent les anciens, les autres sont conservés ; la mesure garde la date la
 * plus récente des deux.
 */
export function recordProgress(
  entries: readonly ProgressEntry[],
  entry: ProgressEntry,
  today: IsoDate,
): RecordedProgress {
  const check = checkProgressEntry(entries, entry, today);
  if (check.status === 'invalide') return { check, entries };
  const previous = sameWeek(entries, entry.date);
  const date = previous && previous.date > entry.date ? previous.date : entry.date;
  const weightKg = entry.weightKg ?? previous?.weightKg;
  const waistCm = entry.waistCm ?? previous?.waistCm;
  const saved: ProgressEntry = {
    date,
    ...(weightKg === undefined ? {} : { weightKg }),
    ...(waistCm === undefined ? {} : { waistCm }),
  };
  const next = [...entries.filter((e) => e !== previous && e.date !== date), saved].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  return {
    check,
    entries: next,
    saved,
    ...(previous && previous.date !== date ? { replacedDate: previous.date } : {}),
  };
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
