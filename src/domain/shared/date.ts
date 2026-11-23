import type { IsoDate } from './shared.types';

/**
 * Calculs de dates calendaires purs sur des chaînes `YYYY-MM-DD`.
 * Tout est calculé en UTC pour éviter les surprises de fuseau horaire ;
 * aucune lecture de l'heure courante (elle arrive en paramètre).
 */

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Convertit une date ISO en `Date` UTC à minuit. Lève `RangeError` si la date est invalide. */
export function toUtcDate(date: IsoDate): Date {
  const match = ISO_DATE_PATTERN.exec(date);
  if (!match) throw new RangeError(`Date ISO invalide : ${date}`);
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const utc = new Date(Date.UTC(y, m - 1, d));
  if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) {
    throw new RangeError(`Date ISO invalide : ${date}`);
  }
  return utc;
}

/** Formate une `Date` (lue en UTC) en `YYYY-MM-DD`. */
export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** Vrai si la chaîne est une date ISO calendaire valide. */
export function isIsoDate(value: string): boolean {
  try {
    toUtcDate(value);
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return toIsoDate(new Date(toUtcDate(date).getTime() + days * MS_PER_DAY));
}

/** Nombre de jours de `from` à `to` (négatif si `to` est avant). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / MS_PER_DAY);
}

/** Jour de la semaine : 0 = lundi … 6 = dimanche. */
export function dayOfWeek(date: IsoDate): number {
  return (toUtcDate(date).getUTCDay() + 6) % 7;
}

/** Samedi ou dimanche. */
export function isWeekend(date: IsoDate): boolean {
  return dayOfWeek(date) >= 5;
}

/** Lundi de la semaine contenant `date`. */
export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, -dayOfWeek(date));
}

/** Mois de 1 (janvier) à 12 (décembre). */
export function monthOf(date: IsoDate): number {
  return toUtcDate(date).getUTCMonth() + 1;
}

/** Semaine ISO 8601 au format `YYYY-Www` (la semaine 1 contient le premier jeudi de l'année). */
export function isoWeekKey(date: IsoDate): string {
  const thursday = toUtcDate(addDays(startOfWeek(date), 3));
  const year = thursday.getUTCFullYear();
  const firstThursdayWeekStart = startOfWeek(isoDateOfFirstThursday(year));
  const week = Math.floor(daysBetween(firstThursdayWeekStart, toIsoDate(thursday)) / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function isoDateOfFirstThursday(year: number): IsoDate {
  const jan1 = toIsoDate(new Date(Date.UTC(year, 0, 1)));
  return addDays(jan1, (3 - dayOfWeek(jan1) + 7) % 7);
}
