import type { Sex } from './profile.constants';

/**
 * Parcours des questions du profil : une question à la fois dans l'onboarding (Nutry la pose
 * dans une bulle), les mêmes en liste dans les écrans d'édition du Profil. Les textes sont ici
 * (ADR 0010) : ils sont indissociables de la règle « quelles questions pose-t-on ? »
 * (la question de grossesse n'est posée qu'aux personnes concernées), au tutoiement.
 */
export const PROFILE_QUESTION_IDS = [
  'age',
  'sex',
  'pregnancy',
  'height',
  'weight',
  'waist',
  'activity',
  'healthCondition',
  'goal',
  'dietBase',
  'dietExtras',
  'allergens',
  'likes',
  'dislikes',
  'household',
  'weekdayMinutes',
  'weekendMinutes',
  'weekdayLevel',
  'weekendLevel',
  'breakfast',
  'batchCooking',
] as const;
export type ProfileQuestionId = (typeof PROFILE_QUESTION_IDS)[number];

export interface ProfileQuestionText {
  /** Intitulé court (écrans d'édition du Profil, nom accessible du groupe). */
  readonly label: string;
  /** Ce que Nutry demande, dans sa bulle. */
  readonly prompt: string;
  readonly hint?: string;
  /** Réponse facultative : l'onboarding propose « Passer ». */
  readonly optional: boolean;
}

export const PROFILE_QUESTIONS: Readonly<Record<ProfileQuestionId, ProfileQuestionText>> = {
  age: { label: 'Âge', prompt: 'Tu as quel âge ?', optional: false },
  sex: {
    label: 'Sexe',
    prompt: 'Tu es…',
    hint: 'Pour estimer tes besoins.',
    optional: false,
  },
  pregnancy: {
    label: 'Enceinte ou allaitante',
    prompt: 'Tu es enceinte ou tu allaites ?',
    hint: 'On adapte les recettes (ni alcool, ni cru).',
    optional: false,
  },
  height: { label: 'Taille', prompt: 'Tu mesures combien ?', optional: false },
  weight: {
    label: 'Poids',
    prompt: 'Et tu pèses combien ?',
    hint: 'Ça reste entre nous : tout est sur ton téléphone.',
    optional: false,
  },
  waist: {
    label: 'Tour de taille',
    prompt: 'Tu connais ton tour de taille ?',
    hint: 'Facultatif.',
    optional: true,
  },
  activity: {
    label: 'Ton activité au quotidien',
    prompt: 'Tu bouges comment au quotidien ?',
    optional: false,
  },
  healthCondition: {
    label: 'As-tu une condition de santé particulière ?',
    prompt: 'Une condition de santé dont je dois tenir compte ?',
    hint: 'Facultatif. Par exemple un diabète, un trouble alimentaire, une maladie rénale ou un traitement en cours. On restera tout en douceur.',
    optional: true,
  },
  goal: { label: 'Ton objectif', prompt: 'Quel est ton objectif ?', optional: false },
  dietBase: { label: 'Ton alimentation', prompt: 'Tu manges comment ?', optional: false },
  dietExtras: {
    label: 'Sans…',
    prompt: 'Un « sans » à respecter ?',
    hint: 'Facultatif.',
    optional: true,
  },
  allergens: {
    label: 'Allergies',
    prompt: 'Tu as des allergies ?',
    hint: 'Les plats qui en contiennent ne seront jamais proposés.',
    optional: true,
  },
  likes: {
    label: 'J’adore',
    prompt: 'Qu’est-ce que tu adores ?',
    hint: 'On te les proposera plus souvent.',
    optional: true,
  },
  dislikes: {
    label: 'Je n’aime pas',
    prompt: 'Et ce que tu n’aimes pas ?',
    hint: 'Tu ne les verras plus dans ton menu.',
    optional: true,
  },
  household: {
    label: 'Combien êtes-vous à table ?',
    prompt: 'Vous êtes combien à table ?',
    optional: true,
  },
  weekdayMinutes: {
    label: 'Temps pour cuisiner en semaine',
    prompt: 'Tu as combien de temps pour cuisiner en semaine ?',
    optional: true,
  },
  weekendMinutes: {
    label: 'Temps pour cuisiner le week-end',
    prompt: 'Et le week-end ?',
    optional: true,
  },
  weekdayLevel: {
    label: 'Niveau en semaine',
    prompt: 'En semaine, tu préfères cuisiner comment ?',
    optional: true,
  },
  weekendLevel: {
    label: 'Niveau le week-end',
    prompt: 'Et le week-end ?',
    optional: true,
  },
  breakfast: {
    label: 'Petit-déjeuner',
    prompt: 'Je te propose aussi un petit-déjeuner ?',
    hint: 'Ajoute une idée chaque matin.',
    optional: true,
  },
  batchCooking: {
    label: 'Cuisiner en avance le dimanche',
    prompt: 'Tu veux cuisiner en avance le dimanche ?',
    hint: 'Une liste de préparations à faire le dimanche (céréales, légumes, sauces, plats entiers) pour aller plus vite en semaine.',
    optional: true,
  },
};

export type ProfileStepId = 'moi' | 'objectif' | 'gouts' | 'organisation';

export interface ProfileStep {
  readonly id: ProfileStepId;
  readonly title: string;
  readonly intro: string;
  readonly questions: readonly ProfileQuestionId[];
}

/** Les quatre parties du profil, dans l'ordre de l'onboarding. */
export const PROFILE_STEPS: readonly ProfileStep[] = [
  {
    id: 'moi',
    title: 'Faisons connaissance',
    intro: 'Pour ajuster tes portions. Tout reste sur ton téléphone.',
    questions: [
      'age',
      'sex',
      'pregnancy',
      'height',
      'weight',
      'waist',
      'activity',
      'healthCondition',
    ],
  },
  {
    id: 'objectif',
    title: 'Ton objectif',
    intro: 'Et ce que tu ne manges pas.',
    questions: ['goal', 'dietBase', 'dietExtras', 'allergens'],
  },
  {
    id: 'gouts',
    title: 'Tes goûts',
    intro: 'Touche ce que tu adores… et ce que tu évites.',
    questions: ['likes', 'dislikes'],
  },
  {
    id: 'organisation',
    title: 'Ton organisation',
    intro: 'Pour un menu qui tient dans ta semaine.',
    questions: [
      'household',
      'weekdayMinutes',
      'weekendMinutes',
      'weekdayLevel',
      'weekendLevel',
      'breakfast',
      'batchCooking',
    ],
  },
];

/**
 * Questions à poser dans l'ordre. Garde-fou de santé : la question de grossesse et
 * d'allaitement n'est posée qu'une fois le sexe connu et différent de « homme ».
 */
export function onboardingQuestions(sex: Sex | undefined): readonly ProfileQuestionId[] {
  const askPregnancy = sex !== undefined && sex !== 'homme';
  return PROFILE_STEPS.flatMap((step) => step.questions).filter(
    (id) => id !== 'pregnancy' || askPregnancy,
  );
}

/** Partie du profil à laquelle appartient une question. */
export function stepOfQuestion(id: ProfileQuestionId): ProfileStep {
  const step = PROFILE_STEPS.find((s) => s.questions.includes(id));
  // Toute question appartient à une partie (vérifié par les tests).
  return step ?? (PROFILE_STEPS[0] as ProfileStep);
}
