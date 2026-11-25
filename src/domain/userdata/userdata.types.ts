import type { CompanionState } from '../companion';
import type { WeeklyPlan } from '../mealplan';
import type { MealRating } from '../preferences';
import type { Profile } from '../profile';
import type { ProgressEntry } from '../progress';
import type { QuizState } from '../quiz';
import type { IsoDate, IsoDateTime } from '../shared';
import type { ShoppingState } from '../shopping';
import type { PainReport, SavedTrainingPlan, SessionLog, TrainingProfile } from '../training';

export const THEMES = ['system', 'light', 'dark'] as const;
/** Thème d'affichage : celui du système ou forcé. */
export type Theme = (typeof THEMES)[number];

/** Réglages de l'app, stockés sur l'appareil. */
export interface UserSettings {
  readonly theme: Theme;
  /**
   * Choix explicite de la personne pour le suivi du poids. Absent : on suit
   * `weightTrackingEnabledByDefault` du profil (désactivé pour tout profil protégé :
   * mineur, grossesse ou allaitement, condition de santé, IMC bas ; ADR 0007).
   */
  readonly weightTracking?: boolean;
  /** Fin du premier onboarding (point de départ du rappel de sauvegarde). */
  readonly profileCreatedAt?: IsoDateTime;
  /** Dernière sauvegarde exportée (ou importée). */
  readonly lastBackupAt?: IsoDateTime;
  /** Dernier jour (local) où le rappel de sauvegarde a été montré. */
  readonly lastBackupReminderOn?: IsoDate;
  /** Le navigateur a accordé le stockage persistant (propre à cet appareil). */
  readonly persistenceGranted?: boolean;
  /** Dernier jour (local) où la suggestion de niveau d'activité a été refusée (ADR 0015). */
  readonly activitySuggestionDismissedOn?: IsoDate;
}

/**
 * Menu enregistré : le menu du domain, plus l'empreinte des contraintes alimentaires
 * du profil au moment de la génération (voir `dietaryFingerprint`).
 */
export interface SavedPlan extends WeeklyPlan {
  readonly constraintsKey: string;
  readonly generatedAt: IsoDateTime;
}

/**
 * Avis enregistré. `id` vaut `semaine:repas` quand l'avis porte sur un repas du menu
 * (un seul avis par repas, le dernier remplace le précédent), sinon `recette@date`.
 */
export interface RatingRecord extends MealRating {
  readonly id: string;
  readonly weekStart?: IsoDate;
  readonly mealId?: string;
}

/** État de la liste de courses d'une semaine, lié au menu dont il est issu. */
export interface ShoppingRecord {
  readonly weekStart: IsoDate;
  /**
   * Empreinte du menu et des portions (`shoppingBasisKey`) : si elle change, les
   * coches des ingrédients sont remises à zéro.
   */
  readonly basisKey: string;
  readonly state: ShoppingState;
}

/** Version courante du format des données exportées. */
export const SNAPSHOT_SCHEMA_VERSION = 4;

/** Toutes les données de la personne, telles qu'exportées ou importées. */
export interface UserDataSnapshot {
  readonly schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  readonly profile?: Profile;
  readonly plans: readonly SavedPlan[];
  readonly ratings: readonly RatingRecord[];
  readonly progress: readonly ProgressEntry[];
  readonly quiz: QuizState;
  readonly companion: CompanionState;
  readonly shopping: readonly ShoppingRecord[];
  readonly settings: UserSettings;
  /** Profil sportif ; absent : le Sport n'est pas activé (ADR 0015). */
  readonly training?: TrainingProfile;
  readonly trainingPlans: readonly SavedTrainingPlan[];
  readonly sessionLogs: readonly SessionLog[];
  readonly painReports: readonly PainReport[];
}

/** Fichier de sauvegarde en clair : un instantané daté, marqué comme venant de Nutry. */
export interface BackupFile extends UserDataSnapshot {
  readonly app: 'nutry';
  readonly exportedAt: IsoDateTime;
}
