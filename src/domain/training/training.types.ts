import type { DayIndex } from '../mealplan';
import type { IsoDate, IsoDateTime } from '../shared';
import type {
  EffortFeeling,
  Equipment,
  EquipmentSetting,
  ExerciseKind,
  ExerciseMeasure,
  ExerciseTag,
  MovementPattern,
  MuscleGroup,
  PregnancyStage,
  SessionDuration,
  SessionKind,
  SlotRole,
  TrainingFrequency,
  TrainingGoal,
  TrainingIntensity,
  TrainingLevel,
} from './training.constants';

// ------------------------------------------------------------------- Catalogue

/**
 * Exercice du catalogue, tel que le domain le connaît : ni chemin d'image, ni crédit, ni lien
 * (ceux-là passent par le port `ExerciseCatalog`, ADR 0015). Textes en français.
 */
export interface Exercise {
  /** Identifiant stable, kebab-case ASCII (ex. `pompes-genoux`). */
  readonly id: string;
  readonly name: string;
  readonly kind: ExerciseKind;
  readonly pattern: MovementPattern;
  /**
   * Clé de pose du mannequin SVG (kebab-case, ex. `squat`) : plusieurs exercices peuvent
   * partager une pose. Le domain ne connaît pas le dessin, seulement sa clé.
   */
  readonly movement: string;
  /** Groupes travaillés en premier lieu (comptent 1 série dans le volume). */
  readonly primaryMuscles: readonly MuscleGroup[];
  /** Groupes sollicités en renfort (comptent 0,5 série). */
  readonly secondaryMuscles: readonly MuscleGroup[];
  /** Matériel requis, tout à la fois ; vide = poids du corps. */
  readonly equipment: readonly Equipment[];
  /** Niveau minimal conseillé. */
  readonly level: TrainingLevel;
  readonly measure: ExerciseMeasure;
  /** Se fait côté par côté (les répétitions s'entendent « par côté »). */
  readonly unilateral: boolean;
  /** Contraintes lues par les garde-fous santé. */
  readonly tags: readonly ExerciseTag[];
  /** Consignes, une étape par entrée. */
  readonly instructions: readonly string[];
  /** Conseils et erreurs fréquentes (facultatif). */
  readonly tips: readonly string[];
  /** Variante plus facile / plus difficile du même schéma (progression, douleur). */
  readonly easierId?: string;
  readonly harderId?: string;
}

// --------------------------------------------------------------- Profil sportif

/** Réponses de l'onboarding Sport, modifiables ensuite. Absent : le Sport n'est pas activé. */
export interface TrainingProfile {
  readonly frequency: TrainingFrequency;
  /** Jours choisis (0 = lundi), triés, sans doublon, autant que `frequency`. */
  readonly days: readonly DayIndex[];
  readonly setting: EquipmentSetting;
  /** Matériel disponible (préréglé par `setting`, ajustable). */
  readonly equipment: readonly Equipment[];
  readonly level: TrainingLevel;
  readonly goal: TrainingGoal;
  readonly sessionMinutes: SessionDuration;
  /** Seulement si `Profile.pregnantOrBreastfeeding` ; absent = règle la plus protectrice. */
  readonly pregnancyStage?: PregnancyStage;
  /** Lundi de la première semaine d'entraînement (origine des blocs). */
  readonly startedOn: IsoDate;
  /** Jour où la personne a lu le message de prudence (garde-fou avec avis médical). */
  readonly safetyAcknowledgedOn?: IsoDate;
}

// ------------------------------------------------------------ Garde-fous santé

export type TrainingSafetyMessageCode =
  | 'avertissement'
  | 'grossesse'
  | 'post-partum'
  | 'condition-sante'
  | 'senior'
  | 'mineur'
  | 'debutant'
  | 'douleur'
  | 'douleur-repetee'
  | 'urgence';

export interface TrainingSafetyMessage {
  readonly code: TrainingSafetyMessageCode;
  readonly text: string;
  /** Vrai si le message invite à consulter (médecin, sage-femme, kiné). */
  readonly suggestProfessional: boolean;
}

/**
 * Bilan des garde-fous (fonction pure de `Profile` + `TrainingProfile`). Les exclusions sont
 * des filtres durs appliqués par toute fonction qui propose un exercice.
 */
export interface TrainingSafety {
  /** Exercices portant l'une de ces étiquettes : jamais proposés. */
  readonly excludedTags: readonly ExerciseTag[];
  /** Étiquettes pénalisées au classement (proposées seulement à défaut). */
  readonly discouragedTags: readonly ExerciseTag[];
  readonly intensity: TrainingIntensity;
  /** Faux : la charge n'augmente jamais (maintien), seules les répétitions progressent. */
  readonly loadProgression: boolean;
  /** Séances de renforcement au plus ; les autres jours deviennent `douce`. */
  readonly maxStrengthSessions: number;
  /** Plancher de répétitions par série. */
  readonly minReps: number;
  /** Ajoute un bloc équilibre et mobilité aux séances complètes (70 ans et plus). */
  readonly includeBalance: boolean;
  /** Le premier écran Sport demande une lecture explicite (« J'ai compris »). */
  readonly requiresAcknowledgement: boolean;
  readonly messages: readonly TrainingSafetyMessage[];
}

// -------------------------------------------------------------------- Gabarits

/** Créneau d'un gabarit de séance : un schéma de mouvement et un rôle. */
export interface SessionSlot {
  readonly pattern: MovementPattern;
  readonly role: SlotRole;
}

/**
 * Bloc de 1 ou 2 créneaux, abandonné d'un seul tenant quand la durée cible l'exige : un bloc
 * associe poussée et tirage, ou genou et hanche, pour que les équilibres tiennent toujours.
 */
export type SessionBlock = readonly [SessionSlot] | readonly [SessionSlot, SessionSlot];

export interface SessionTemplate {
  readonly kind: SessionKind;
  /** Titre affiché (« Haut du corps A »), ADR 0010. */
  readonly title: string;
  /** Blocs dans l'ordre d'exécution ; les derniers sont abandonnés en premier. */
  readonly blocks: readonly SessionBlock[];
  /** Blocs gardés au minimum, même si la durée cible est dépassée (1 pour les séances de 20 min). */
  readonly minBlocks: number;
  /**
   * Blocs « autonomes » (équilibrés à eux seuls : poussée et tirage, ou genou et hanche) :
   * pour 20 min, un seul bloc est gardé, qui alterne parmi ceux-là d'une séance à l'autre.
   */
  readonly shortBlocks: readonly number[];
}

// ------------------------------------------------------------------ Planning

export type SplitName = 'full-body' | 'haut-bas' | 'ppl' | 'ppl-haut-bas' | 'haut-bas-full';

/** Répartition retenue : un type de séance par jour d'entraînement. */
export interface SplitAssignment {
  readonly split: SplitName;
  readonly sessions: readonly { readonly dayIndex: DayIndex; readonly kind: SessionKind }[];
  /** Des séances sont devenues `douce` pour respecter le plafond de renforcement. */
  readonly capped: boolean;
  /** Des séances sont devenues `douce` faute de 48 h de récupération entre les jours choisis. */
  readonly tooClose: boolean;
}

/** Cible d'une série : répétitions (fourchette) ou durée (secondes). */
export type SetTarget =
  | { readonly measure: 'repetitions'; readonly minReps: number; readonly maxReps: number }
  | { readonly measure: 'duree'; readonly minSeconds: number; readonly maxSeconds: number };

/** Conseil de progression affiché sous l'exercice. */
export type ProgressionAdvice =
  | 'trouve-ta-charge'
  | 'ajoute-une-repetition'
  | 'augmente-la-charge'
  | 'maintiens'
  | 'allege'
  | 'variante-plus-dure'
  | 'semaine-allegee';

/** Prescription d'un exercice pour une semaine donnée. */
export interface Prescription {
  readonly sets: number;
  readonly target: SetTarget;
  readonly restSeconds: number;
  /** Charge proposée (kg) ; absente au poids du corps ou tant qu'elle n'est pas connue. */
  readonly loadKg?: number;
  readonly advice: ProgressionAdvice;
  /** Répétitions en réserve conseillées (3 en intensité modérée). */
  readonly repsInReserve: number;
}

export interface PlannedExercise {
  /** Identifiant stable dans la séance, ex. `b1-s0` (bloc, créneau). */
  readonly slotId: string;
  readonly exerciseId: string;
  readonly pattern: MovementPattern;
  readonly role: SlotRole;
  /** Se fait côté par côté : la durée estimée double (recopié de l'exercice). */
  readonly unilateral: boolean;
  readonly prescription: Prescription;
}

export interface PlannedSession {
  /** Identifiant stable dans la semaine : le jour, ex. `d2`. */
  readonly id: string;
  readonly dayIndex: DayIndex;
  readonly date: IsoDate;
  readonly kind: SessionKind;
  readonly title: string;
  /** Mouvements doux enchaînés (durée en secondes par mouvement). */
  readonly warmup: readonly PlannedExercise[];
  readonly main: readonly PlannedExercise[];
  readonly cooldown: readonly PlannedExercise[];
  readonly estimatedMinutes: number;
  /** Groupes fortement sollicités (base de la règle des 48 h). */
  readonly heavyGroups: readonly MuscleGroup[];
}

/** Position dans le cycle de progression. */
export interface CycleInfo {
  /** Semaines actives (au moins une séance faite) avant celle-ci. */
  readonly activeWeeks: number;
  readonly blockIndex: number;
  /** 1 à `blockLength`. */
  readonly weekInBlock: number;
  readonly blockLength: number;
  readonly deload: boolean;
  readonly deloadReason?: 'cycle' | 'reprise';
}

export type TrainingNoticeCode =
  | 'jours-rapproches'
  | 'seances-plafonnees'
  | 'catalogue-insuffisant'
  | 'semaine-allegee'
  | 'reprise';

export interface TrainingNotice {
  readonly code: TrainingNoticeCode;
  readonly message: string;
}

/** Programme d'une semaine (lundi → dimanche). Nommé ainsi pour ne pas croiser le `WeeklyPlan` des repas. */
export interface WeeklyTrainingPlan {
  readonly weekStart: IsoDate;
  readonly split: SplitName;
  readonly cycle: CycleInfo;
  readonly sessions: readonly PlannedSession[];
  readonly notices: readonly TrainingNotice[];
}

// ------------------------------------------------------------------- Journal

/** Une série réalisée (ou prévue et pas encore faite). */
export interface SetLog {
  /** 0, 1, 2… dans l'exercice. */
  readonly index: number;
  readonly done: boolean;
  readonly reps?: number;
  readonly seconds?: number;
  readonly loadKg?: number;
}

export interface ExerciseLog {
  readonly slotId: string;
  readonly exerciseId: string;
  /** Exercice prévu, si celui-ci l'a remplacé (choix ou douleur). */
  readonly replacedExerciseId?: string;
  readonly sets: readonly SetLog[];
  /** Validé d'un geste (« fait ») : toutes ses séries comptent comme faites. */
  readonly done: boolean;
  readonly effort?: EffortFeeling;
}

export type SessionStatus = 'en-cours' | 'terminee';

/** Journal d'une séance. `id` = `${weekStart}:${sessionId}` (une seule par séance prévue). */
export interface SessionLog {
  readonly id: string;
  readonly weekStart: IsoDate;
  readonly sessionId: string;
  /** Jour (local) où la séance a été faite ; peut différer du jour prévu. */
  readonly date: IsoDate;
  readonly status: SessionStatus;
  readonly startedAt: IsoDateTime;
  readonly completedAt?: IsoDateTime;
  readonly exercises: readonly ExerciseLog[];
  readonly effort?: EffortFeeling;
}

/** « Ça fait mal » : l'exercice est écarté `PAIN_RULES.avoidDays` jours. */
export interface PainReport {
  /** `${date}:${exerciseId}`. */
  readonly id: string;
  readonly date: IsoDate;
  readonly exerciseId: string;
  /** Muscles principaux de l'exercice au moment du signalement (douleur répétée). */
  readonly muscles: readonly MuscleGroup[];
}

/** Programme enregistré : le programme du domain et l'empreinte de ses contraintes. */
export interface SavedTrainingPlan extends WeeklyTrainingPlan {
  /** Voir `trainingConstraintsKey` : si elle change, le programme est régénéré. */
  readonly constraintsKey: string;
  readonly generatedAt: IsoDateTime;
}

// ----------------------------------------------------------- Lien Nourriture

/** Ce que la partie Nourriture sait du Sport : les jours de séance, rien d'autre. */
export interface TrainingDaysForMeals {
  readonly weekStart: IsoDate;
  readonly trainingDays: readonly DayIndex[];
}
