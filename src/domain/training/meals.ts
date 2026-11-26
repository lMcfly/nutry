import { ACTIVITY_LEVELS } from '../profile';
import { ACTIVITY_FLOOR_BY_WEEKLY_MINUTES } from './training.constants';
import type { SuggestActivityLevel } from './training.contracts';
import type { TrainingDaysForMeals, WeeklyTrainingPlan } from './training.types';

/**
 * Jours de séance (hors séances douces) transmis à la partie Nourriture, triés et sans doublon.
 * C'est tout ce que la Nourriture sait du Sport (ADR 0015, section 6).
 */
export function trainingDaysOf(plan: WeeklyTrainingPlan): TrainingDaysForMeals {
  const days = plan.sessions
    .filter((session) => session.kind !== 'douce')
    .map((session) => session.dayIndex);
  return {
    weekStart: plan.weekStart,
    trainingDays: [...new Set(days)].sort((a, b) => a - b),
  };
}

/** Minutes d'entraînement prévues par semaine : fréquence × durée de séance. */
export function weeklyTrainingMinutes(training: {
  readonly frequency: number;
  readonly sessionMinutes: number;
}): number {
  return training.frequency * training.sessionMinutes;
}

/**
 * Suggestion (jamais automatique) de relever le niveau d'activité du profil : si le volume prévu
 * atteint le plancher d'un niveau plus haut que celui déclaré, on propose le niveau SUIVANT,
 * d'un cran au plus, même si le volume en justifierait davantage. `undefined` si rien à proposer.
 * Ne change aucune portion ni aucune calorie : c'est l'utilisateur qui confirme (ou refuse).
 */
export const suggestActivityLevel: SuggestActivityLevel = (declared, training) => {
  const minutes = weeklyTrainingMinutes(training);
  const floor = ACTIVITY_FLOOR_BY_WEEKLY_MINUTES.filter((step) => minutes >= step.fromMinutes).at(
    -1,
  )?.activity;
  if (floor === undefined) return undefined;
  const declaredIndex = ACTIVITY_LEVELS.indexOf(declared);
  if (ACTIVITY_LEVELS.indexOf(floor) <= declaredIndex) return undefined;
  return ACTIVITY_LEVELS[declaredIndex + 1];
};
