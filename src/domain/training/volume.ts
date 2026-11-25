import {
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  type MovementPattern,
  type MuscleGroup,
} from './training.constants';
import type { Exercise, WeeklyTrainingPlan } from './training.types';

/**
 * Séries de la semaine par groupe musculaire : 1 par série pour un muscle principal, 0,5 pour un
 * muscle secondaire (ADR 0015, étape 5). Seuls les exercices principaux des séances comptent
 * (ni échauffement ni retour au calme).
 */
export function weeklyVolumeByGroup(
  plan: WeeklyTrainingPlan,
  catalog: readonly Exercise[],
): Readonly<Record<MuscleGroup, number>> {
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const totals = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, 0])) as Record<
    MuscleGroup,
    number
  >;
  for (const session of plan.sessions) {
    for (const item of session.main) {
      const exercise = byId.get(item.exerciseId);
      if (!exercise) continue;
      for (const group of exercise.primaryMuscles) totals[group] += item.prescription.sets;
      for (const group of exercise.secondaryMuscles) totals[group] += item.prescription.sets * 0.5;
    }
  }
  return totals;
}

/** Séries de la semaine par schéma de mouvement (équilibres poussée/tirage et genou/hanche). */
export function weeklySetsByPattern(
  plan: WeeklyTrainingPlan,
): Readonly<Record<MovementPattern, number>> {
  const totals = Object.fromEntries(MOVEMENT_PATTERNS.map((pattern) => [pattern, 0])) as Record<
    MovementPattern,
    number
  >;
  for (const session of plan.sessions) {
    for (const item of session.main) totals[item.pattern] += item.prescription.sets;
  }
  return totals;
}
