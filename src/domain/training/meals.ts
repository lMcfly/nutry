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
