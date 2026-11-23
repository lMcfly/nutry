import { isWeekend } from '../shared';
import type { IsoDate } from '../shared';
import type { Level } from '../recipe';
import type { Profile } from '../profile';

export interface DayRequirements {
  readonly level: Level;
  /** Temps disponible par repas (minutes). */
  readonly minutes: number;
  readonly weekend: boolean;
}

/** Niveau et temps d'un jour : semaine = lundi-vendredi, week-end = samedi-dimanche. */
export function dayRequirements(
  profile: Pick<Profile, 'weekdayLevel' | 'weekendLevel' | 'weekdayMinutes' | 'weekendMinutes'>,
  date: IsoDate,
): DayRequirements {
  const weekend = isWeekend(date);
  return weekend
    ? { level: profile.weekendLevel, minutes: profile.weekendMinutes, weekend }
    : { level: profile.weekdayLevel, minutes: profile.weekdayMinutes, weekend };
}
