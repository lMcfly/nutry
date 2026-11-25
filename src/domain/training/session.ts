import type { IsoDate, IsoDateTime } from '../shared';
import type { EffortFeeling } from './training.constants';
import type {
  ExerciseLog,
  PlannedExercise,
  PlannedSession,
  SessionLog,
  SetLog,
} from './training.types';

/** Journal d'une séance : `id` = `${weekStart}:${sessionId}`. */
export function sessionLogId(weekStart: IsoDate, sessionId: string): string {
  return `${weekStart}:${sessionId}`;
}

function emptyExerciseLog(item: PlannedExercise): ExerciseLog {
  return {
    slotId: item.slotId,
    exerciseId: item.exerciseId,
    sets: Array.from({ length: item.prescription.sets }, (_, index) => ({ index, done: false })),
    done: false,
  };
}

/**
 * Ouvre le journal d'une séance : une ligne par exercice principal, toutes les séries prévues
 * et non faites. `date` est le jour (local) où la personne s'entraîne, `startedAt` l'instant :
 * les deux arrivent en paramètre (aucune lecture de l'heure).
 */
export function startSessionLog(
  session: PlannedSession,
  weekStart: IsoDate,
  date: IsoDate,
  startedAt: IsoDateTime,
): SessionLog {
  return {
    id: sessionLogId(weekStart, session.id),
    weekStart,
    sessionId: session.id,
    date,
    status: 'en-cours',
    startedAt,
    exercises: session.main.map(emptyExerciseLog),
  };
}

function updateExercise(
  log: SessionLog,
  slotId: string,
  update: (exercise: ExerciseLog) => ExerciseLog,
): SessionLog {
  return {
    ...log,
    exercises: log.exercises.map((exercise) =>
      exercise.slotId === slotId ? update(exercise) : exercise,
    ),
  };
}

/**
 * Enregistre une série (cochée ou non, avec répétitions, secondes ou charge). Une série hors
 * de l'exercice est ajoutée à la suite ; un exercice inconnu laisse le journal inchangé.
 */
export function logSet(log: SessionLog, slotId: string, set: SetLog): SessionLog {
  return updateExercise(log, slotId, (exercise) => {
    const known = exercise.sets.some((s) => s.index === set.index);
    const sets = known
      ? exercise.sets.map((s) => (s.index === set.index ? set : s))
      : [...exercise.sets, set].sort((a, b) => a.index - b.index);
    // Décocher une série annule le « fait » global de l'exercice.
    return { ...exercise, sets, done: set.done ? exercise.done : false };
  });
}

/** « Fait » pour tout l'exercice : il est validé et toutes ses séries comptent comme faites. */
export function markExerciseDone(log: SessionLog, slotId: string): SessionLog {
  return updateExercise(log, slotId, (exercise) => ({
    ...exercise,
    done: true,
    sets: exercise.sets.map((set) => ({ ...set, done: true })),
  }));
}

/** Remplace l'exercice réalisé (choix ou douleur), en gardant trace de l'exercice prévu. */
export function replaceExerciseInLog(
  log: SessionLog,
  slotId: string,
  newExerciseId: string,
): SessionLog {
  return updateExercise(log, slotId, (exercise) => ({
    ...exercise,
    replacedExerciseId: exercise.replacedExerciseId ?? exercise.exerciseId,
    exerciseId: newExerciseId,
    done: false,
    sets: exercise.sets.map(({ index }) => ({ index, done: false })),
  }));
}

/** Termine la séance (la personne peut la terminer avant la fin) avec un ressenti facultatif. */
export function finishSessionLog(
  log: SessionLog,
  completedAt: IsoDateTime,
  effort?: EffortFeeling,
): SessionLog {
  return {
    ...log,
    status: 'terminee',
    completedAt,
    ...(effort !== undefined ? { effort } : {}),
  };
}

const setsDone = (exercise: ExerciseLog): number =>
  exercise.done ? exercise.sets.length : exercise.sets.filter((set) => set.done).length;

const isExerciseDone = (exercise: ExerciseLog | undefined): boolean =>
  exercise !== undefined &&
  (exercise.done || (exercise.sets.length > 0 && exercise.sets.every((set) => set.done)));

/**
 * Une séance est terminée quand chaque exercice principal est fait (validé, ou toutes ses
 * séries faites), ou quand la personne la termine avec au moins une série faite. Seule une séance
 * terminée compte comme geste pour la série de Nutry : cocher une série seule ne suffit pas.
 * Sans exercice principal (catalogue incomplet), tous les exercices de la séance comptent.
 */
export function isSessionComplete(session: PlannedSession, log: SessionLog): boolean {
  const principals = session.main.filter((item) => item.role === 'principal');
  const required = principals.length > 0 ? principals : session.main;
  const allDone =
    required.length > 0 &&
    required.every((item) => isExerciseDone(log.exercises.find((e) => e.slotId === item.slotId)));
  if (allDone) return true;
  return log.status === 'terminee' && log.exercises.some((exercise) => setsDone(exercise) > 0);
}

/** Avancement de la séance : séries faites et prévues (exercices principaux), part de 0 à 1. */
export function sessionCompletion(
  session: PlannedSession,
  log: SessionLog,
): { readonly doneSets: number; readonly plannedSets: number; readonly ratio: number } {
  let doneSets = 0;
  let plannedSets = 0;
  for (const item of session.main) {
    const planned = item.prescription.sets;
    plannedSets += planned;
    const exercise = log.exercises.find((e) => e.slotId === item.slotId);
    if (exercise) doneSets += Math.min(planned, exercise.done ? planned : setsDone(exercise));
  }
  return { doneSets, plannedSets, ratio: plannedSets === 0 ? 0 : doneSets / plannedSets };
}
