import type { DayIndex } from '../mealplan';
import type { Profile } from '../profile';
import { startOfWeek, type IsoDate } from '../shared';
import {
  DEFAULT_TRAINING_DAYS,
  EQUIPMENT,
  EQUIPMENT_BY_SETTING,
  EQUIPMENT_SETTINGS,
  PREGNANCY_STAGES,
  SESSION_DURATIONS,
  TRAINING_FREQUENCIES,
  TRAINING_GOALS,
  TRAINING_LEVELS,
  type Equipment,
  type EquipmentSetting,
  type PregnancyStage,
  type SessionDuration,
  type TrainingFrequency,
  type TrainingGoal,
  type TrainingLevel,
} from './training.constants';
import type { TrainingProfile } from './training.types';

/**
 * Onboarding Sport (ADR 0015, section 9) : cinq écrans facultatifs, plus l'étape de grossesse.
 * Textes ici (ADR 0010) : ils sont indissociables de la règle « quelles questions pose-t-on ? »
 * (l'étape de grossesse n'est demandée qu'aux personnes concernées), au tutoiement.
 */

export const TRAINING_INVITATION = {
  title: 'Envie de bouger avec Nutry ?',
  body: 'Je te propose une semaine d’entraînement à ton rythme, avec une séance guidée pas à pas. C’est facultatif : tu peux changer d’avis à tout moment.',
  accept: 'Oui, on essaie',
  decline: 'Pas maintenant',
} as const;

export const TRAINING_QUESTION_IDS = [
  'frequency',
  'days',
  'setting',
  'level',
  'goal',
  'duration',
  'pregnancyStage',
] as const;
export type TrainingQuestionId = (typeof TRAINING_QUESTION_IDS)[number];

export interface TrainingQuestionText {
  readonly label: string;
  /** Ce que Nutry demande, dans sa bulle. */
  readonly prompt: string;
  readonly hint?: string;
}

export const TRAINING_QUESTIONS: Readonly<Record<TrainingQuestionId, TrainingQuestionText>> = {
  frequency: {
    label: 'Séances par semaine',
    prompt: 'Combien de fois par semaine as-tu envie de bouger ?',
    hint: 'Mieux vaut peu et régulier que beaucoup et trop vite.',
  },
  days: {
    label: 'Jours de séance',
    prompt: 'Quels jours te conviennent ?',
    hint: 'Je les ai préremplis ; change-les si besoin. Deux jours d’écart laissent les muscles récupérer.',
  },
  setting: {
    label: 'Où t’entraînes-tu ?',
    prompt: 'Où t’entraînes-tu ?',
    hint: 'Tu pourras ajuster ton matériel ensuite.',
  },
  level: { label: 'Ton niveau', prompt: 'Quel est ton niveau ?' },
  goal: { label: 'Ton objectif', prompt: 'Quel est ton objectif ?' },
  duration: { label: 'Durée d’une séance', prompt: 'Combien de temps par séance ?' },
  pregnancyStage: {
    label: 'Où en es-tu ?',
    prompt: 'Où en es-tu ?',
    hint: 'Pour adapter les mouvements en douceur. Sans réponse, je choisis la prudence.',
  },
};

export interface TrainingAnswerText {
  readonly label: string;
  readonly description?: string;
}

/** Intitulés des réponses proposées (cartes de l'onboarding). */
export const TRAINING_ANSWERS: {
  readonly frequency: Readonly<Record<TrainingFrequency, TrainingAnswerText>>;
  readonly setting: Readonly<Record<EquipmentSetting, TrainingAnswerText>>;
  readonly level: Readonly<Record<TrainingLevel, TrainingAnswerText>>;
  readonly goal: Readonly<Record<TrainingGoal, TrainingAnswerText>>;
  readonly duration: Readonly<Record<SessionDuration, TrainingAnswerText>>;
  readonly pregnancyStage: Readonly<Record<PregnancyStage, TrainingAnswerText>>;
} = {
  frequency: {
    1: { label: '1 fois' },
    2: { label: '2 fois' },
    3: { label: '3 fois', description: 'Un bon départ' },
    4: { label: '4 fois' },
    5: { label: '5 fois' },
    6: { label: '6 fois' },
  },
  setting: {
    maison: { label: 'À la maison', description: 'Sans matériel' },
    'maison-equipee': {
      label: 'À la maison, équipé',
      description: 'Avec des haltères ou des élastiques',
    },
    salle: { label: 'En salle', description: 'Avec le matériel de la salle' },
  },
  level: {
    debutant: { label: 'Débutant', description: 'Je débute ou je reprends' },
    intermediaire: { label: 'Intermédiaire', description: 'Je m’entraîne déjà régulièrement' },
    confirme: { label: 'Confirmé', description: 'Je m’entraîne depuis longtemps' },
  },
  goal: {
    forme: { label: 'Me sentir en forme', description: 'Bouger, rester tonique' },
    force: {
      label: 'Gagner en force',
      description: 'Des charges plus lourdes, moins de répétitions',
    },
    muscle: { label: 'Me muscler', description: 'Développer mes muscles' },
    endurance: {
      label: 'Gagner en endurance',
      description: 'Plus de répétitions, moins de charge',
    },
  },
  duration: {
    20: { label: '20 min', description: 'Court et efficace' },
    30: { label: '30 min' },
    45: { label: '45 min' },
    60: { label: '60 min' },
  },
  pregnancyStage: {
    'premier-trimestre': { label: 'Premier trimestre' },
    'apres-premier-trimestre': { label: 'Deuxième ou troisième trimestre' },
    'post-partum': { label: 'Après la naissance ou en allaitant' },
  },
};

/** Réponses de l'onboarding Sport (le profil sportif sans `startedOn` ni accusé de lecture). */
export interface TrainingProfileInput {
  readonly frequency: TrainingFrequency;
  readonly days: readonly DayIndex[];
  readonly setting: EquipmentSetting;
  readonly equipment: readonly Equipment[];
  readonly level: TrainingLevel;
  readonly goal: TrainingGoal;
  readonly sessionMinutes: SessionDuration;
  readonly pregnancyStage?: PregnancyStage;
}

/** Réponses proposées d'emblée : 3 séances, à la maison, débutant, en forme, 30 minutes. */
export function defaultTrainingInput(): TrainingProfileInput {
  const frequency: TrainingFrequency = 3;
  const setting: EquipmentSetting = 'maison';
  return {
    frequency,
    days: DEFAULT_TRAINING_DAYS[frequency],
    setting,
    equipment: EQUIPMENT_BY_SETTING[setting],
    level: 'debutant',
    goal: 'forme',
    sessionMinutes: 30,
  };
}

/** L'étape de grossesse n'est demandée que si le profil déclare une grossesse ou un allaitement. */
export function asksPregnancyStage(profile: Profile): boolean {
  return profile.pregnantOrBreastfeeding && profile.sex !== 'homme';
}

export const TRAINING_INPUT_MESSAGES = {
  frequency: 'Choisis entre 1 et 6 séances par semaine.',
  days: 'Choisis autant de jours différents que de séances par semaine.',
  setting: 'Choisis où tu t’entraînes.',
  equipment: 'Ce matériel n’est pas dans la liste.',
  level: 'Choisis ton niveau.',
  goal: 'Choisis ton objectif.',
  sessionMinutes: 'Choisis une durée de 20, 30, 45 ou 60 minutes.',
  pregnancyStage: 'Cette étape n’est pas dans la liste.',
} as const;

export interface TrainingInputIssue {
  readonly field: keyof typeof TRAINING_INPUT_MESSAGES;
  readonly message: string;
}

const includes = <T extends string | number>(list: readonly T[], value: unknown): value is T =>
  list.includes(value as T);

/** Valide les réponses (données venues de l'interface : rien n'est supposé). */
export function validateTrainingInput(input: TrainingProfileInput): TrainingInputIssue[] {
  const issues: TrainingInputIssue[] = [];
  const add = (field: TrainingInputIssue['field']) => {
    issues.push({ field, message: TRAINING_INPUT_MESSAGES[field] });
  };
  if (!includes(TRAINING_FREQUENCIES, input.frequency)) add('frequency');
  const days: readonly unknown[] = input.days;
  const validDays =
    days.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6) &&
    new Set(days).size === days.length;
  if (!validDays || days.length !== input.frequency) add('days');
  if (!includes(EQUIPMENT_SETTINGS, input.setting)) add('setting');
  if (!input.equipment.every((item) => includes(EQUIPMENT, item))) add('equipment');
  if (!includes(TRAINING_LEVELS, input.level)) add('level');
  if (!includes(TRAINING_GOALS, input.goal)) add('goal');
  if (!includes(SESSION_DURATIONS, input.sessionMinutes)) add('sessionMinutes');
  if (input.pregnancyStage !== undefined && !includes(PREGNANCY_STAGES, input.pregnancyStage)) {
    add('pregnancyStage');
  }
  return issues;
}

/**
 * Profil sportif à enregistrer, à partir de réponses valides : jours triés, matériel sans
 * doublon, étape de grossesse conservée seulement si elle a un sens, `startedOn` gardé d'une
 * édition à l'autre (origine des blocs), accusé de lecture gardé tant que l'étape ne change pas.
 */
export function buildTrainingProfile(input: {
  readonly answers: TrainingProfileInput;
  readonly profile: Profile;
  readonly existing: TrainingProfile | undefined;
  readonly today: IsoDate;
}): TrainingProfile {
  const { answers, profile, existing } = input;
  const pregnancyStage = asksPregnancyStage(profile) ? answers.pregnancyStage : undefined;
  const acknowledgedOn =
    existing?.pregnancyStage === pregnancyStage ? existing?.safetyAcknowledgedOn : undefined;
  return {
    frequency: answers.frequency,
    days: [...answers.days].sort((a, b) => a - b),
    setting: answers.setting,
    equipment: EQUIPMENT.filter((item) => answers.equipment.includes(item)),
    level: answers.level,
    goal: answers.goal,
    sessionMinutes: answers.sessionMinutes,
    ...(pregnancyStage === undefined ? {} : { pregnancyStage }),
    startedOn: existing?.startedOn ?? startOfWeek(input.today),
    ...(acknowledgedOn === undefined ? {} : { safetyAcknowledgedOn: acknowledgedOn }),
  };
}

/** Réponses modifiables d'un profil sportif existant. */
export function trainingInputOf(training: TrainingProfile): TrainingProfileInput {
  return {
    frequency: training.frequency,
    days: training.days,
    setting: training.setting,
    equipment: training.equipment,
    level: training.level,
    goal: training.goal,
    sessionMinutes: training.sessionMinutes,
    ...(training.pregnancyStage === undefined ? {} : { pregnancyStage: training.pregnancyStage }),
  };
}
