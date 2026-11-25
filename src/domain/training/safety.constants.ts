import type { ExerciseTag } from './training.constants';
import type { TrainingSafetyMessage, TrainingSafetyMessageCode } from './training.types';

/**
 * Garde-fous santé du Sport (ADR 0015, dans l'esprit de l'ADR 0007 : ils priment sur tout).
 * Textes au tutoiement, sans culpabilisation (ADR 0010). Appliqués par `assessTrainingSafety`.
 */

/** Mention permanente de l'écran Sport et de la fiche d'exercice. */
export const TRAINING_DISCLAIMER = 'Nutry ne remplace pas un coach ni un médecin.';

export const TRAINING_SAFETY_MESSAGES: Readonly<
  Record<TrainingSafetyMessageCode, TrainingSafetyMessage>
> = {
  avertissement: {
    code: 'avertissement',
    text: 'Avance à ton rythme et écoute ton corps. Nutry ne remplace pas un coach ni un médecin.',
    suggestProfessional: false,
  },
  grossesse: {
    code: 'grossesse',
    text: 'Bouger pendant la grossesse fait du bien, en douceur : pas de sauts, pas d’exercice à plat ventre ni, après le premier trimestre, allongée sur le dos. Tu dois pouvoir parler pendant l’effort. Demande l’avis de ta sage-femme ou de ton médecin avant de commencer.',
    suggestProfessional: true,
  },
  'post-partum': {
    code: 'post-partum',
    text: 'Après une naissance, le corps a besoin de temps : pas de sauts ni d’abdominaux en enroulement pour l’instant. Demande l’avis de ta sage-femme ou de ton médecin, notamment pour la rééducation du périnée, avant de reprendre.',
    suggestProfessional: true,
  },
  'condition-sante': {
    code: 'condition-sante',
    text: 'Avec une condition de santé particulière, l’activité physique se prépare : parles-en à ton médecin avant de commencer. Ici, les séances restent modérées.',
    suggestProfessional: true,
  },
  senior: {
    code: 'senior',
    text: 'Tes séances font la part belle à l’équilibre et à la mobilité, sans sauts. Garde un appui à portée de main (mur, chaise) et parles-en à ton médecin si tu reprends après une longue pause.',
    suggestProfessional: true,
  },
  mineur: {
    code: 'mineur',
    text: 'Avant 18 ans, on privilégie la technique et des charges légères. Si possible, entraîne-toi avec un adulte ou un encadrant.',
    suggestProfessional: false,
  },
  debutant: {
    code: 'debutant',
    text: 'On commence en douceur : la technique d’abord, la charge ensuite. Garde toujours deux ou trois répétitions en réserve.',
    suggestProfessional: false,
  },
  douleur: {
    code: 'douleur',
    text: 'Arrête cet exercice. Une gêne musculaire passe, une douleur vive ou dans une articulation, non : si elle dure ou revient, consulte un médecin ou un kiné. On le remplace par un mouvement plus doux.',
    suggestProfessional: true,
  },
  'douleur-repetee': {
    code: 'douleur-repetee',
    text: 'C’est la deuxième fois que cette zone te fait mal en peu de temps. Mets-la au repos quelques jours et parles-en à un médecin ou à un kiné.',
    suggestProfessional: true,
  },
  urgence: {
    code: 'urgence',
    text: 'Douleur dans la poitrine, malaise, essoufflement inhabituel ou vertige : arrête tout et appelle le 15 (ou le 112).',
    suggestProfessional: true,
  },
};

/** Étiquettes exclues (filtre dur) selon la situation. */
export const SAFETY_EXCLUDED_TAGS = {
  /** Grossesse, 1er trimestre. */
  grossessePremierTrimestre: [
    'impact',
    'haute-intensite',
    'allonge-ventre',
    'flexion-tronc',
    'instable',
    'charge-axiale',
  ],
  /** Grossesse après le 1er trimestre, ou étape inconnue (règle la plus protectrice). */
  grossesse: [
    'impact',
    'haute-intensite',
    'allonge-ventre',
    'allonge-dos',
    'flexion-tronc',
    'instable',
    'charge-axiale',
  ],
  postPartum: ['impact', 'haute-intensite', 'flexion-tronc'],
  conditionSante: ['impact', 'haute-intensite'],
  senior: ['impact', 'haute-intensite', 'instable', 'charge-axiale'],
  mineur: ['charge-axiale'],
} as const satisfies Readonly<Record<string, readonly ExerciseTag[]>>;

/** Étiquettes seulement pénalisées au classement. */
export const SAFETY_DISCOURAGED_TAGS = {
  senior: ['au-sol', 'allonge-ventre'],
  debutant: ['charge-axiale', 'instable'],
} as const satisfies Readonly<Record<string, readonly ExerciseTag[]>>;
