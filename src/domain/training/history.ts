import type { IsoDate } from '../shared';
import type { EffortFeeling } from './training.constants';
import type { ExerciseLog, SessionLog, SessionStatus, WeeklyTrainingPlan } from './training.types';

/** Une ligne de l'historique des séances. */
export interface SessionHistoryEntry {
  readonly id: string;
  readonly weekStart: IsoDate;
  readonly sessionId: string;
  readonly date: IsoDate;
  readonly status: SessionStatus;
  /** Titre de la séance prévue, s'il reste dans un programme enregistré. */
  readonly title?: string;
  readonly exerciseCount: number;
  readonly doneSets: number;
  readonly effort?: EffortFeeling;
}

const doneSetsOf = (exercise: ExerciseLog): number =>
  exercise.done ? exercise.sets.length : exercise.sets.filter((set) => set.done).length;

/** Historique, de la séance la plus récente à la plus ancienne (même jour : identifiant). */
export function sessionHistory(
  logs: readonly SessionLog[],
  plans: readonly WeeklyTrainingPlan[],
): SessionHistoryEntry[] {
  const titles = new Map<string, string>();
  for (const plan of plans) {
    for (const session of plan.sessions)
      titles.set(`${plan.weekStart}:${session.id}`, session.title);
  }
  return [...logs]
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1))
    .map((log) => {
      const title = titles.get(log.id);
      return {
        id: log.id,
        weekStart: log.weekStart,
        sessionId: log.sessionId,
        date: log.date,
        status: log.status,
        ...(title === undefined ? {} : { title }),
        exerciseCount: log.exercises.length,
        doneSets: log.exercises.reduce((sum, exercise) => sum + doneSetsOf(exercise), 0),
        ...(log.effort === undefined ? {} : { effort: log.effort }),
      };
    });
}
