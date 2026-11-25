/**
 * Vocabulaires fermés et barèmes du module Sport (ADR 0015).
 * Tableaux `as const` : source unique des types TS et des schémas Zod (ADR 0005).
 * Identifiants ASCII en kebab-case ; les libellés affichés relèvent de la présentation
 * (`presentation/i18n/labels.ts`), sauf les messages liés à une règle (ADR 0010).
 */

import type { DayIndex } from '../mealplan';
import type { ActivityLevel } from '../profile';

// ------------------------------------------------------------------ Vocabulaires

/**
 * Groupes musculaires de Nutry. Correspondance avec les muscles wger (ADR 0015) :
 * deltoïde antérieur → epaules ; biceps, brachial → biceps ; biceps fémoral → ischio-jambiers ;
 * gastrocnémien, soléaire → mollets ; grand fessier → fessiers ; grand dorsal, trapèze → dos ;
 * grand droit, obliques → abdominaux ; grand pectoral, dentelé antérieur → pectoraux ;
 * quadriceps → quadriceps ; triceps → triceps. `lombaires` est posé à la main (curation).
 */
export const MUSCLE_GROUPS = [
  'pectoraux',
  'dos',
  'epaules',
  'biceps',
  'triceps',
  'abdominaux',
  'lombaires',
  'fessiers',
  'quadriceps',
  'ischio-jambiers',
  'mollets',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/**
 * Schéma de mouvement : unité de planification (un créneau de séance demande un schéma,
 * pas un exercice précis). Sert aux équilibres poussée/tirage et genou/hanche.
 */
export const MOVEMENT_PATTERNS = [
  'poussee-horizontale',
  'poussee-verticale',
  'tirage-horizontal',
  'tirage-vertical',
  'genou',
  'hanche',
  'gainage',
  'flexion-coude',
  'extension-coude',
  'mollets',
  'cardio',
  'mobilite',
  'equilibre',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

/** Nature d'un exercice. Le schéma de mouvement la détermine (`PATTERN_KIND`). */
export const EXERCISE_KINDS = ['force', 'cardio', 'mobilite', 'equilibre'] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];

/** Comment se mesure une série : en répétitions ou en secondes (gainage, mobilité…). */
export const EXERCISE_MEASURES = ['repetitions', 'duree'] as const;
export type ExerciseMeasure = (typeof EXERCISE_MEASURES)[number];

/**
 * Matériel. Correspondance wger : Barbell → barre, SZ-Bar → barre-ez, Dumbbell → halteres,
 * Kettlebell → kettlebell, Resistance band → elastique, Bench → banc, Incline bench →
 * banc-incline, Pull-up bar → barre-traction, Cable machine → poulie, Swiss Ball →
 * swiss-ball, Gym mat → tapis, none (bodyweight) → aucun matériel (liste vide).
 */
export const EQUIPMENT = [
  'tapis',
  'halteres',
  'elastique',
  'kettlebell',
  'barre',
  'barre-ez',
  'banc',
  'banc-incline',
  'barre-traction',
  'poulie',
  'swiss-ball',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

/** Cadre d'entraînement choisi à l'onboarding ; préremplit le matériel disponible. */
export const EQUIPMENT_SETTINGS = ['maison', 'maison-equipee', 'salle'] as const;
export type EquipmentSetting = (typeof EQUIPMENT_SETTINGS)[number];

/** Niveau sportif (distinct des niveaux de recettes `Level`). */
export const TRAINING_LEVELS = ['debutant', 'intermediaire', 'confirme'] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];

/** Objectif sportif : fixe les fourchettes de répétitions et les repos. */
export const TRAINING_GOALS = ['forme', 'force', 'muscle', 'endurance'] as const;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];

/** Fréquences proposées (séances par semaine). */
export const TRAINING_FREQUENCIES = [1, 2, 3, 4, 5, 6] as const;
export type TrainingFrequency = (typeof TRAINING_FREQUENCIES)[number];

/** Durées cibles d'une séance, échauffement et retour au calme compris (minutes). */
export const SESSION_DURATIONS = [20, 30, 45, 60] as const;
export type SessionDuration = (typeof SESSION_DURATIONS)[number];

/**
 * Contraintes portées par un exercice, lues par les garde-fous santé.
 * - `allonge-dos` : sur le dos (déconseillé après le 1er trimestre de grossesse) ;
 * - `allonge-ventre` : à plat ventre ;
 * - `impact` : sauts, pliométrie, course ;
 * - `haute-intensite` : très essoufflant (burpees…) ;
 * - `flexion-tronc` : enroulement du buste (crunch, relevé de buste) ;
 * - `charge-axiale` : charge posée sur les épaules ou la colonne (squat barre…) ;
 * - `instable` : support instable (swiss ball, appui sur une jambe sans appui) ;
 * - `au-sol` : demande de descendre au sol et de se relever.
 */
export const EXERCISE_TAGS = [
  'allonge-dos',
  'allonge-ventre',
  'impact',
  'haute-intensite',
  'flexion-tronc',
  'charge-axiale',
  'instable',
  'au-sol',
] as const;
export type ExerciseTag = (typeof EXERCISE_TAGS)[number];

/**
 * Étape de grossesse, demandée seulement si `Profile.pregnantOrBreastfeeding`. Absente :
 * on applique la règle la plus protectrice (`apres-premier-trimestre`).
 */
export const PREGNANCY_STAGES = [
  'premier-trimestre',
  'apres-premier-trimestre',
  'post-partum',
] as const;
export type PregnancyStage = (typeof PREGNANCY_STAGES)[number];

/** Rôle d'un créneau dans une séance : fixe le nombre de séries et l'ordre d'abandon. */
export const SLOT_ROLES = ['principal', 'secondaire', 'accessoire'] as const;
export type SlotRole = (typeof SLOT_ROLES)[number];

/** Types de séance (gabarits de `templates.ts`). `douce` : mobilité, équilibre, cardio léger. */
export const SESSION_KINDS = [
  'full-a',
  'full-b',
  'full-c',
  'haut-a',
  'haut-b',
  'bas-a',
  'bas-b',
  'poussee',
  'tirage',
  'jambes',
  'douce',
] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

/** Ressenti facultatif après un exercice ou une séance. */
export const EFFORT_FEELINGS = ['facile', 'correct', 'difficile'] as const;
export type EffortFeeling = (typeof EFFORT_FEELINGS)[number];

/** Intensité autorisée : `moderee` = « tu dois pouvoir parler », 3 répétitions en réserve. */
export const TRAINING_INTENSITIES = ['normale', 'moderee'] as const;
export type TrainingIntensity = (typeof TRAINING_INTENSITIES)[number];

// ---------------------------------------------------------- Correspondances fixes

/** Nature de l'exercice selon son schéma de mouvement. */
export const PATTERN_KIND: Readonly<Record<MovementPattern, ExerciseKind>> = {
  'poussee-horizontale': 'force',
  'poussee-verticale': 'force',
  'tirage-horizontal': 'force',
  'tirage-vertical': 'force',
  genou: 'force',
  hanche: 'force',
  gainage: 'force',
  'flexion-coude': 'force',
  'extension-coude': 'force',
  mollets: 'force',
  cardio: 'cardio',
  mobilite: 'mobilite',
  equilibre: 'equilibre',
};

/**
 * Groupes que chaque schéma a le droit de solliciter en muscle principal. Un exercice
 * dont un muscle principal sort de cette liste n'est pas éligible au créneau : c'est ce qui
 * rend la règle des 48 h vérifiable au niveau des gabarits (`templateHeavyGroups`).
 */
export const PATTERN_PRIMARY_GROUPS: Readonly<Record<MovementPattern, readonly MuscleGroup[]>> = {
  'poussee-horizontale': ['pectoraux', 'triceps', 'epaules'],
  'poussee-verticale': ['epaules', 'triceps'],
  'tirage-horizontal': ['dos', 'biceps'],
  'tirage-vertical': ['dos', 'biceps'],
  genou: ['quadriceps', 'fessiers'],
  hanche: ['fessiers', 'ischio-jambiers', 'lombaires'],
  gainage: ['abdominaux', 'lombaires'],
  'flexion-coude': ['biceps'],
  'extension-coude': ['triceps'],
  mollets: ['mollets'],
  cardio: [],
  mobilite: [],
  equilibre: [],
};

/**
 * Schémas peu fatigants : ils ne comptent pas dans la règle des 48 h (le tronc se travaille
 * souvent, la mobilité et l'équilibre aident à récupérer).
 */
export const RECOVERY_EXEMPT_PATTERNS: readonly MovementPattern[] = [
  'gainage',
  'cardio',
  'mobilite',
  'equilibre',
];

export const PUSH_PATTERNS: readonly MovementPattern[] = [
  'poussee-horizontale',
  'poussee-verticale',
];
export const PULL_PATTERNS: readonly MovementPattern[] = ['tirage-horizontal', 'tirage-vertical'];

/** Matériel toujours supposé disponible (une serviette pliée fait un tapis). */
export const ALWAYS_AVAILABLE_EQUIPMENT: readonly Equipment[] = ['tapis'];

/** Matériel préconfiguré par cadre ; la personne peut ensuite cocher ou décocher. */
export const EQUIPMENT_BY_SETTING: Readonly<Record<EquipmentSetting, readonly Equipment[]>> = {
  maison: ['tapis'],
  'maison-equipee': ['tapis', 'halteres', 'elastique'],
  salle: [
    'tapis',
    'halteres',
    'elastique',
    'kettlebell',
    'barre',
    'barre-ez',
    'banc',
    'banc-incline',
    'barre-traction',
    'poulie',
    'swiss-ball',
  ],
};

/**
 * Matériel préféré par cadre pour les créneaux `principal` (bonus de sélection) :
 * à la salle, les charges libres et la poulie ; à la maison, le poids du corps.
 */
export const PREFERRED_EQUIPMENT: Readonly<Record<EquipmentSetting, readonly Equipment[]>> = {
  maison: [],
  'maison-equipee': ['halteres', 'elastique'],
  salle: ['barre', 'halteres', 'poulie', 'barre-traction'],
};

// --------------------------------------------------------------------- Barèmes

/** Écart minimal, en jours, entre deux séances qui sollicitent fortement un même groupe. */
export const MIN_RECOVERY_DAYS = 2;

/** Jours par défaut (0 = lundi) selon la fréquence : séances espacées, dimanche libre. */
export const DEFAULT_TRAINING_DAYS: Readonly<Record<TrainingFrequency, readonly DayIndex[]>> = {
  1: [5],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
};

/** Séances de renforcement au plus par semaine ; au-delà, séances `douce`. */
export const MAX_STRENGTH_SESSIONS: Readonly<Record<TrainingLevel, number>> = {
  debutant: 4,
  intermediaire: 6,
  confirme: 6,
};
/** Plafond pour les 70 ans et plus et pour une condition de santé déclarée. */
export const MAX_STRENGTH_SESSIONS_PROTECTED = 3;

/** Fourchette de répétitions (double progression) et repos, par objectif. */
export interface RepScheme {
  readonly minReps: number;
  readonly maxReps: number;
  readonly restSeconds: number;
}
export const REP_SCHEMES: Readonly<Record<TrainingGoal, RepScheme>> = {
  force: { minReps: 6, maxReps: 8, restSeconds: 150 },
  muscle: { minReps: 8, maxReps: 12, restSeconds: 90 },
  forme: { minReps: 10, maxReps: 15, restSeconds: 60 },
  endurance: { minReps: 15, maxReps: 20, restSeconds: 45 },
};
/** Jamais moins de répétitions par série pour ces profils (charges plus légères). */
export const MIN_REPS_BEGINNER = 8;
export const MIN_REPS_PROTECTED = 10;
/** Exercices en durée : fourchette en secondes par niveau, repos fixe. */
export const HOLD_SECONDS: Readonly<Record<TrainingLevel, { min: number; max: number }>> = {
  debutant: { min: 20, max: 30 },
  intermediaire: { min: 30, max: 45 },
  confirme: { min: 40, max: 60 },
};
export const HOLD_REST_SECONDS = 45;
/** Un accessoire : +2 répétitions aux deux bornes, repos −30 s (45 s au moins). */
export const ACCESSORY_REP_BONUS = 2;
export const ACCESSORY_REST_REDUCTION_SECONDS = 30;
export const MIN_REST_SECONDS = 45;

/** Séries par créneau selon le rôle et le niveau. */
export const SETS_BY_ROLE: Readonly<Record<SlotRole, Readonly<Record<TrainingLevel, number>>>> = {
  principal: { debutant: 3, intermediaire: 3, confirme: 4 },
  secondaire: { debutant: 3, intermediaire: 3, confirme: 3 },
  accessoire: { debutant: 2, intermediaire: 2, confirme: 3 },
};
/** Plancher de séries quand la durée cible oblige à raccourcir. */
export const MIN_SETS_WHEN_TRIMMED = 2;

/**
 * Volume hebdomadaire (séries par groupe : muscle principal = 1, secondaire = 0,5).
 * `max` est un plafond vérifié ; `min` une cible vérifiée dès 3 séances de 45 min.
 */
export const WEEKLY_VOLUME: Readonly<Record<TrainingLevel, { min: number; max: number }>> = {
  debutant: { min: 4, max: 12 },
  intermediaire: { min: 8, max: 18 },
  confirme: { min: 10, max: 22 },
};

/** Équilibres hebdomadaires (en séries) : tirage/poussée et genou/hanche. */
export const BALANCE_RULES = {
  pullToPushMin: 1,
  pullToPushMax: 2,
  kneeToHipMin: 0.67,
  kneeToHipMax: 1.5,
} as const;

/** Estimation de durée d'une séance. */
export const TIMING = {
  /** Temps moyen d'une répétition (tempo contrôlé). */
  secondsPerRep: 4,
  /** Installation et changement d'exercice. */
  transitionSeconds: 60,
  /** Échauffement : 3 min pour 20 min, 5 min sinon. */
  warmupMinutes: { short: 3, normal: 5 },
  cooldownMinutes: { short: 2, normal: 4 },
  /** Tolérance de dépassement de la durée cible. */
  overrunRatio: 0.1,
} as const;

/** Semaine allégée : la dernière semaine de chaque bloc, selon le niveau. */
export const DELOAD_EVERY_WEEKS: Readonly<Record<TrainingLevel, number>> = {
  debutant: 6,
  intermediaire: 5,
  confirme: 4,
};
/** Semaine allégée : séries × 0,5 (arrondi au-dessus), charges × 0,9, pas de progression. */
export const DELOAD = { setsRatio: 0.5, loadRatio: 0.9 } as const;
/** Après autant de semaines sans séance, la semaine suivante est une reprise (allégée). */
export const RETURN_AFTER_BREAK_WEEKS = 2;
/** Nombre de meilleurs candidats entre lesquels la rotation alterne. */
export const ROTATION_POOL = 3;

/** Incréments de charge de la double progression (kg). Sans charge : variante plus dure. */
export const LOAD_INCREMENT_KG: Readonly<Partial<Record<Equipment, number>>> = {
  halteres: 1,
  kettlebell: 4,
  barre: 2.5,
  'barre-ez': 2.5,
  poulie: 2.5,
};
/** Au poids du corps : au-delà de ce nombre de répétitions, proposer la variante plus dure. */
export const BODYWEIGHT_REP_CEILING = 20;
/** Baisse de charge après deux séances sous la borne basse. */
export const LOAD_DECREASE_RATIO = 0.9;

/** Douleurs : deux signalements sur un même groupe en 14 jours déclenchent le conseil d'arrêt. */
export const PAIN_RULES = { windowDays: 14, repeatedThreshold: 2, avoidDays: 28 } as const;

/** Âge à partir duquel la séance privilégie équilibre et mobilité (repère ADR 0007). */
export const TRAINING_SENIOR_AGE = 70;

/**
 * Lien Nourriture : niveau d'activité minimal cohérent avec le volume d'entraînement prévu
 * (fréquence × durée, minutes par semaine). Sert seulement à *suggérer* une mise à jour du
 * profil, d'un cran au plus, jamais à modifier les portions d'office (ADR 0015).
 */
export const ACTIVITY_FLOOR_BY_WEEKLY_MINUTES: readonly {
  readonly fromMinutes: number;
  readonly activity: ActivityLevel;
}[] = [
  { fromMinutes: 60, activity: 'leger' },
  { fromMinutes: 150, activity: 'modere' },
  { fromMinutes: 300, activity: 'actif' },
];
