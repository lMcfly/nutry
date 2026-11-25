import type { Profile } from '../profile';
import {
  SAFETY_DISCOURAGED_TAGS,
  SAFETY_EXCLUDED_TAGS,
  TRAINING_SAFETY_MESSAGES,
} from './safety.constants';
import {
  EXERCISE_TAGS,
  MAX_STRENGTH_SESSIONS,
  MAX_STRENGTH_SESSIONS_PROTECTED,
  MIN_REPS_BEGINNER,
  MIN_REPS_PROTECTED,
  TRAINING_SENIOR_AGE,
  type ExerciseTag,
} from './training.constants';
import type {
  Exercise,
  TrainingProfile,
  TrainingSafety,
  TrainingSafetyMessage,
  TrainingSafetyMessageCode,
} from './training.types';

const ADULT_AGE = 18;

/** Réunit des listes d'étiquettes, dans l'ordre fixe de `EXERCISE_TAGS` (sortie déterministe). */
function unionTags(...lists: readonly (readonly ExerciseTag[])[]): ExerciseTag[] {
  return EXERCISE_TAGS.filter((tag) => lists.some((list) => list.includes(tag)));
}

/**
 * Garde-fous santé du Sport (ADR 0015, section 5) : fonction pure de `Profile` et de
 * `TrainingProfile`. Les règles se cumulent : exclusions réunies, plafond de séances le plus
 * bas, plancher de répétitions le plus haut. L'étape de grossesse n'est lue que si le profil
 * déclare une grossesse ou un allaitement (sexe « femme » ou « autre », comme l'ADR 0007) ;
 * sans réponse, la règle la plus protectrice (après le 1er trimestre) s'applique.
 */
export function assessTrainingSafety(profile: Profile, training: TrainingProfile): TrainingSafety {
  const pregnantOrNursing = profile.pregnantOrBreastfeeding && profile.sex !== 'homme';
  const stage = pregnantOrNursing
    ? (training.pregnancyStage ?? 'apres-premier-trimestre')
    : undefined;
  const pregnant = stage === 'premier-trimestre' || stage === 'apres-premier-trimestre';
  const postPartum = stage === 'post-partum';
  const condition = profile.healthCondition === true;
  const senior = profile.age >= TRAINING_SENIOR_AGE;
  const minor = profile.age < ADULT_AGE;
  const beginner = training.level === 'debutant';
  const moderate = pregnant || postPartum || condition;

  const excluded = unionTags(
    stage === 'premier-trimestre' ? SAFETY_EXCLUDED_TAGS.grossessePremierTrimestre : [],
    stage === 'apres-premier-trimestre' ? SAFETY_EXCLUDED_TAGS.grossesse : [],
    postPartum ? SAFETY_EXCLUDED_TAGS.postPartum : [],
    condition ? SAFETY_EXCLUDED_TAGS.conditionSante : [],
    senior ? SAFETY_EXCLUDED_TAGS.senior : [],
    minor ? SAFETY_EXCLUDED_TAGS.mineur : [],
  );
  const discouraged = unionTags(
    senior ? SAFETY_DISCOURAGED_TAGS.senior : [],
    beginner ? SAFETY_DISCOURAGED_TAGS.debutant : [],
  ).filter((tag) => !excluded.includes(tag));

  const caps = [MAX_STRENGTH_SESSIONS[training.level]];
  if (senior || condition) caps.push(MAX_STRENGTH_SESSIONS_PROTECTED);
  const floors = [0];
  if (beginner) floors.push(MIN_REPS_BEGINNER);
  if (minor || moderate || senior) floors.push(MIN_REPS_PROTECTED);

  const codes: TrainingSafetyMessageCode[] = ['avertissement'];
  if (pregnant) codes.push('grossesse');
  if (postPartum) codes.push('post-partum');
  if (condition) codes.push('condition-sante');
  if (senior) codes.push('senior');
  if (minor) codes.push('mineur');
  if (beginner) codes.push('debutant');
  const messages: readonly TrainingSafetyMessage[] = codes.map(
    (code) => TRAINING_SAFETY_MESSAGES[code],
  );

  return {
    excludedTags: excluded,
    discouragedTags: discouraged,
    intensity: moderate ? 'moderee' : 'normale',
    loadProgression: !moderate,
    maxStrengthSessions: Math.min(...caps),
    minReps: Math.max(...floors),
    includeBalance: senior,
    requiresAcknowledgement: pregnant || postPartum || condition || senior,
    messages,
  };
}

/** Étiquettes d'un exercice que la sécurité exclut (vide = exercice permis). */
export function excludedTagsOf(exercise: Exercise, safety: TrainingSafety): readonly ExerciseTag[] {
  return exercise.tags.filter((tag) => safety.excludedTags.includes(tag));
}
