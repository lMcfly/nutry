/**
 * Petites mises en forme du Sport (présentation) : prescription, corps du mannequin, dates de
 * la semaine. Les textes métier (sécurité, avis, questions) restent dans le domain (ADR 0010).
 */
import type { ExerciseBody } from '@application/usecases';
import { addDays } from '@domain/shared';
import type { Sex } from '@domain/profile';
import type {
  Exercise,
  MuscleGroup,
  PlannedSession,
  Prescription,
  SetTarget,
} from '@domain/training';
import type { BodyId } from './figure/body';
import type { FigureMuscle } from './figure/muscles';
import { MUSCLE_GROUP_LABELS, formatSeconds } from '../../i18n/labels';

/** « 10–15 » répétitions, ou « 30–45 s ». */
export function targetText(target: SetTarget): string {
  if (target.measure === 'repetitions') {
    return target.minReps === target.maxReps
      ? String(target.minReps)
      : `${target.minReps}–${target.maxReps}`;
  }
  return target.minSeconds === target.maxSeconds
    ? formatSeconds(target.minSeconds)
    : `${target.minSeconds}–${formatSeconds(target.maxSeconds)}`;
}

/** « 3 × 10–15 », « 2 × 30–45 s » (et « par côté » pour un exercice unilatéral). */
export function setsText(prescription: Prescription, unilateral: boolean): string {
  const base = `${prescription.sets} × ${targetText(prescription.target)}`;
  return unilateral ? `${base} par côté` : base;
}

/** Version lue par les lecteurs d'écran : « 3 séries de 10 à 15 répétitions ». */
export function setsSpoken(prescription: Prescription, unilateral: boolean): string {
  const { target, sets } = prescription;
  const series = `${sets} série${sets > 1 ? 's' : ''}`;
  const what =
    target.measure === 'repetitions'
      ? target.minReps === target.maxReps
        ? `${target.minReps} répétitions`
        : `${target.minReps} à ${target.maxReps} répétitions`
      : target.minSeconds === target.maxSeconds
        ? formatSeconds(target.minSeconds)
        : `${target.minSeconds} à ${formatSeconds(target.maxSeconds)}`;
  return `${series} de ${what}${unilateral ? ' par côté' : ''}`;
}

/** Corps du mannequin : celui du profil, sinon le choix fait sur l'appareil (sexe « autre »). */
export function bodyFor(sex: Sex | undefined, chosen: ExerciseBody | undefined): BodyId {
  if (sex === 'homme') return 'male';
  if (sex === 'femme') return 'female';
  return chosen === 'homme' ? 'male' : 'female';
}

/** Muscles surlignés : principaux puis secondaires (mêmes identifiants que le mannequin). */
export function figureMuscles(exercise: Exercise): FigureMuscle[] {
  return [...new Set<MuscleGroup>([...exercise.primaryMuscles, ...exercise.secondaryMuscles])];
}

export function muscleList(groups: readonly MuscleGroup[]): string {
  return groups.map((g) => MUSCLE_GROUP_LABELS[g].toLowerCase()).join(', ');
}

/** Les sept dates de la semaine qui commence le lundi `weekStart`. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Tous les exercices d'une séance, dans l'ordre (échauffement, séance, retour au calme). */
export function sessionItems(session: PlannedSession) {
  return [...session.warmup, ...session.main, ...session.cooldown];
}
