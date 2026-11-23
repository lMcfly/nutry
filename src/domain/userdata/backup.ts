import { daysBetween } from '../shared';
import type { IsoDate, IsoDateTime } from '../shared';
import type { UserSettings } from './userdata.types';

/** Rappel doux : pas de sauvegarde depuis 30 jours, et pas de rappel depuis 30 jours. */
export const BACKUP_REMINDER_DAYS = 30;

/** Plus récent de deux instants ISO (comparables comme des chaînes). */
export function latestInstant(
  a: IsoDateTime | undefined,
  b: IsoDateTime | undefined,
): IsoDateTime | undefined {
  if (a === undefined) return b;
  return b === undefined || a > b ? a : b;
}

/**
 * Faut-il montrer le rappel de sauvegarde aujourd'hui ?
 * - jamais sans profil ;
 * - la dernière sauvegarde (ou, à défaut, la fin de l'onboarding) date de 30 jours ou plus ;
 * - le rappel n'a pas été montré depuis 30 jours. S'il a été montré aujourd'hui, il reste
 *   visible toute la journée (appel idempotent, sans surprise si l'écran se recharge).
 * Les jours comparés sont tous LOCAUX : `today` et `localDay` (jour local d'un instant,
 * fourni par le port Clock), jamais le jour UTC d'un instant.
 */
export function isBackupReminderDue(input: {
  readonly hasProfile: boolean;
  readonly settings: UserSettings;
  readonly today: IsoDate;
  readonly localDay: (instant: IsoDateTime) => IsoDate;
}): boolean {
  const { settings, today, localDay } = input;
  if (!input.hasProfile) return false;
  const reference = latestInstant(settings.lastBackupAt, settings.profileCreatedAt);
  if (reference === undefined) return false;
  if (daysBetween(localDay(reference), today) < BACKUP_REMINDER_DAYS) return false;
  const reminded = settings.lastBackupReminderOn;
  if (reminded === undefined || reminded === today) return true;
  return daysBetween(reminded, today) >= BACKUP_REMINDER_DAYS;
}

/** Nom du fichier d'export : `nutry-sauvegarde-AAAA-MM-JJ.json` (ou `.nutry` chiffré). */
export function backupFileName(today: IsoDate, encrypted: boolean): string {
  return `nutry-sauvegarde-${today}.${encrypted ? 'nutry' : 'json'}`;
}

/** Identifiant d'un avis sur un repas du menu : un seul avis par repas. */
export function mealRatingId(weekStart: IsoDate, mealId: string): string {
  return `${weekStart}:${mealId}`;
}

/** Identifiant d'un avis hors menu. */
export function recipeRatingId(recipeId: string, ratedAt: IsoDateTime): string {
  return `${recipeId}@${ratedAt}`;
}
