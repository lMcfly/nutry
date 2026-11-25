import type { Exercise, PlannedExercise, Prescription, SavedTrainingPlan } from './training.types';

/**
 * Programme après le remplacement de l'exercice d'un créneau principal d'une séance (choix
 * ou douleur) : le nouvel exercice prend la place, avec sa prescription. Le programme reste
 * stable ensuite (même empreinte). Séance ou créneau inconnu : programme inchangé.
 */
export function replaceInPlan(
  plan: SavedTrainingPlan,
  sessionId: string,
  slotId: string,
  exercise: Exercise,
  prescription: Prescription,
): SavedTrainingPlan {
  return {
    ...plan,
    sessions: plan.sessions.map((session) =>
      session.id !== sessionId
        ? session
        : {
            ...session,
            main: session.main.map((item): PlannedExercise =>
              item.slotId !== slotId
                ? item
                : {
                    ...item,
                    exerciseId: exercise.id,
                    pattern: exercise.pattern,
                    unilateral: exercise.unilateral,
                    prescription,
                  },
            ),
          },
    ),
  };
}
