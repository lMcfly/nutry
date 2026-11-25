import type { ActivityLevel, Profile } from '../profile';
import type { IsoDate } from '../shared';
import type {
  Equipment,
  ExerciseTag,
  MovementPattern,
  MuscleGroup,
  SessionKind,
  SlotRole,
  TrainingGoal,
  TrainingLevel,
} from './training.constants';
import type {
  CycleInfo,
  Exercise,
  ExerciseLog,
  PainReport,
  PlannedSession,
  Prescription,
  SessionLog,
  TrainingDaysForMeals,
  TrainingProfile,
  TrainingSafety,
  TrainingSafetyMessage,
  WeeklyTrainingPlan,
} from './training.types';

/**
 * Contrat des fonctions principales du module Sport (ADR 0015, plan de la phase 1).
 * Signatures seulement : chaque type sera implémenté par une fonction pure du même nom en
 * camelCase (ex. `PlanTrainingWeek` → `planTrainingWeek` dans `plan.ts`), testée à 90 % et
 * plus. Aucune lecture de l'heure ni de l'aléa : tout arrive en paramètre ; à entrée égale,
 * sortie égale (aucun `Rng` : la rotation dépend des numéros de bloc et de semaine).
 */

/**
 * TODO(phase 1, `safety.ts`) : garde-fous. Grossesse (selon `pregnancyStage`), post-partum,
 * `healthCondition`, 70 ans et plus, moins de 18 ans, débutant. Cumule les exclusions de
 * `SAFETY_EXCLUDED_TAGS`, prend le plafond de séances le plus bas, `intensity: 'moderee'` et
 * `loadProgression: false` pour grossesse, post-partum et condition de santé.
 */
export type AssessTrainingSafety = (profile: Profile, training: TrainingProfile) => TrainingSafety;

/** Contexte de sélection d'un exercice pour un créneau. */
export interface EligibilityContext {
  readonly pattern: MovementPattern;
  readonly role: SlotRole;
  readonly level: TrainingLevel;
  /** Matériel disponible, `ALWAYS_AVAILABLE_EQUIPMENT` compris. */
  readonly equipment: readonly Equipment[];
  readonly safety: TrainingSafety;
  /** Exercices écartés après une douleur (`avoidedExerciseIds`). */
  readonly avoidedExerciseIds: readonly string[];
}

/**
 * TODO(phase 1, `select.ts`) : filtre dur. Même schéma, matériel requis disponible, niveau de
 * l'exercice ≤ niveau, aucune étiquette exclue, pas écarté, muscles principaux inclus dans
 * `PATTERN_PRIMARY_GROUPS[pattern]`.
 */
export type IsExerciseEligible = (exercise: Exercise, context: EligibilityContext) => boolean;

/**
 * TODO(phase 1, `select.ts`) : classement déterministe des éligibles. +3 matériel préféré du
 * cadre (créneau principal), +1 niveau égal à celui de la personne, −2 par étiquette
 * déconseillée, −5 déjà utilisé dans la semaine ; égalité : `id` croissant.
 */
export type RankExercises = (
  candidates: readonly Exercise[],
  context: EligibilityContext & {
    readonly preferredEquipment: readonly Equipment[];
    readonly usedThisWeek: readonly string[];
  },
) => readonly Exercise[];

/**
 * TODO(phase 1, `select.ts`) : rotation. Principal et secondaire : `ranked[blockIndex %
 * min(n, ROTATION_POOL)]` (stables sur un bloc, pour que la progression ait un sens) ;
 * accessoire : `ranked[activeWeeks % min(n, ROTATION_POOL)]`.
 */
export type PickExercise = (
  ranked: readonly Exercise[],
  role: SlotRole,
  cycle: CycleInfo,
) => Exercise | undefined;

/**
 * TODO(phase 1, `cycle.ts`) : semaines actives = semaines (lundis) avant `weekStart` avec au
 * moins une séance terminée. Bloc de `DELOAD_EVERY_WEEKS[level]` semaines, la dernière
 * allégée ; reprise allégée après `RETURN_AFTER_BREAK_WEEKS` semaines sans séance.
 */
export type ComputeCycle = (input: {
  readonly level: TrainingLevel;
  readonly weekStart: IsoDate;
  readonly completedWeekStarts: readonly IsoDate[];
}) => CycleInfo;

/** Historique d'un exercice : ses journaux, du plus ancien au plus récent. */
export interface ExerciseHistoryEntry {
  readonly date: IsoDate;
  readonly log: ExerciseLog;
}

/**
 * TODO(phase 1, `progression.ts`) : double progression. Séries par `SETS_BY_ROLE` ;
 * fourchette par `REP_SCHEMES[goal]` (planchers `minReps` de la sécurité, bonus accessoire) ;
 * toutes les séries à la borne haute → charge + `LOAD_INCREMENT_KG` et retour à la borne basse
 * (poids du corps : borne haute + 2 jusqu'à `BODYWEIGHT_REP_CEILING`, puis
 * `variante-plus-dure`) ; deux séances sous la borne basse → charge × `LOAD_DECREASE_RATIO` ;
 * semaine allégée → `DELOAD` ; `loadProgression: false` → `maintiens`.
 */
export type Prescribe = (input: {
  readonly exercise: Exercise;
  readonly role: SlotRole;
  readonly goal: TrainingGoal;
  readonly level: TrainingLevel;
  readonly safety: TrainingSafety;
  readonly cycle: CycleInfo;
  readonly history: readonly ExerciseHistoryEntry[];
}) => Prescription;

/**
 * TODO(phase 1, `duration.ts`) : échauffement + retour au calme (`TIMING`) + pour chaque
 * exercice : transition + séries × (travail + repos), travail = répétitions moyennes ×
 * `secondsPerRep` (ou secondes tenues), × 2 si unilatéral. Arrondi à la minute.
 */
export type EstimateSessionMinutes = (session: Omit<PlannedSession, 'estimatedMinutes'>) => number;

/**
 * TODO(phase 1, `duration.ts`) : ajuste au temps cible. Dans l'ordre, jusqu'à tenir dans
 * `minutes × (1 + overrunRatio)` : supprimer les accessoires du dernier bloc ; ramener les
 * séries à `MIN_SETS_WHEN_TRIMMED` ; abandonner les derniers blocs jusqu'à `minBlocks`.
 */
export type FitSessionToDuration = (
  session: Omit<PlannedSession, 'estimatedMinutes'>,
  minutes: number,
  blocksBySlot: Readonly<Record<string, number>>,
) => PlannedSession;

/** Entrée du planificateur. */
export interface PlanTrainingWeekInput {
  readonly weekStart: IsoDate;
  readonly profile: Profile;
  readonly training: TrainingProfile;
  readonly catalog: readonly Exercise[];
  /** Journaux passés (toutes semaines) : cycle et progression. */
  readonly logs: readonly SessionLog[];
  readonly painReports: readonly PainReport[];
  /** Jour local, pour la fenêtre des douleurs. */
  readonly today: IsoDate;
}

/**
 * TODO(phase 1, `plan.ts`) : orchestre, sans aléa. `assessTrainingSafety` → `chooseSplit(days,
 * maxStrengthSessions)` → `computeCycle` → pour chaque séance : gabarit (bloc équilibre si
 * `includeBalance`), sélection par créneau, `prescribe`, échauffement (cardio doux puis
 * mobilité des groupes du jour, sans `impact` si exclu), retour au calme (mobilité),
 * `fitSessionToDuration`. Avis : `jours-rapproches`, `seances-plafonnees`,
 * `catalogue-insuffisant` (créneau sans candidat : retiré), `semaine-allegee`, `reprise`.
 */
export type PlanTrainingWeek = (input: PlanTrainingWeekInput) => WeeklyTrainingPlan;

/**
 * TODO(phase 1, `select.ts`) : jusqu'à 3 remplaçants du même schéma, éligibles, sans
 * l'exercice d'origine. `reason: 'douleur'` : d'abord la variante `easierId`, puis sans
 * charge, puis niveau plus bas, et sans les étiquettes de l'exercice douloureux.
 */
export type FindAlternatives = (input: {
  readonly exercise: Exercise;
  readonly reason: 'choix' | 'douleur';
  readonly catalog: readonly Exercise[];
  readonly context: EligibilityContext;
}) => readonly Exercise[];

/**
 * TODO(phase 1, `pain.ts`) : exercices signalés depuis moins de `PAIN_RULES.avoidDays` jours.
 */
export type AvoidedExerciseIds = (
  reports: readonly PainReport[],
  today: IsoDate,
) => readonly string[];

/**
 * TODO(phase 1, `pain.ts`) : messages après un signalement : toujours `douleur` et `urgence` ;
 * `douleur-repetee` si `PAIN_RULES.repeatedThreshold` signalements partagent un groupe
 * musculaire dans les `windowDays` derniers jours.
 */
export type PainMessages = (
  reports: readonly PainReport[],
  today: IsoDate,
) => readonly TrainingSafetyMessage[];

/**
 * TODO(phase 1, `fingerprint.ts`) : empreinte des contraintes qui imposent de régénérer le
 * programme : jours, matériel, niveau, objectif, durée, étape de grossesse, et les champs du
 * profil lus par la sécurité (âge ≥ 70 / < 18, grossesse, condition de santé).
 */
export type TrainingConstraintsKey = (profile: Profile, training: TrainingProfile) => string;

/**
 * TODO(phase 1, `session.ts`) : une séance est terminée quand chaque exercice principal est
 * fait (validé ou toutes ses séries faites), ou quand la personne la termine avec au moins
 * une série faite. Seule une séance terminée compte comme geste pour la série de Nutry.
 */
export type IsSessionComplete = (session: PlannedSession, log: SessionLog) => boolean;

/** TODO(phase 1, `meals.ts`) : jours de séance (hors `douce`) transmis à la partie Nourriture. */
export type TrainingDaysOf = (plan: WeeklyTrainingPlan) => TrainingDaysForMeals;

/**
 * TODO(phase 5, `meals.ts`) : suggestion (jamais automatique) d'un niveau d'activité au moins
 * égal à `ACTIVITY_FLOOR_BY_WEEKLY_MINUTES`, un cran au plus au-dessus du niveau déclaré ;
 * `undefined` si rien à proposer.
 */
export type SuggestActivityLevel = (
  declared: ActivityLevel,
  training: TrainingProfile,
) => ActivityLevel | undefined;

/** Groupes fortement sollicités par un type de séance (implémenté : `templateHeavyGroups`). */
export type TemplateHeavyGroups = (kind: SessionKind) => readonly MuscleGroup[];

/** Étiquettes d'un exercice exclues par la sécurité (aide au test « aucune exclusion »). */
export type ExcludedTagsOf = (exercise: Exercise, safety: TrainingSafety) => readonly ExerciseTag[];
