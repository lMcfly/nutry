import type { IsoDate } from '@domain/shared';
import type { SavedTrainingPlan, TrainingProfile } from '@domain/training';

/** Profil sportif (singleton) et programmes hebdomadaires enregistrés (ADR 0015). */
export interface TrainingRepository {
  /** Profil sportif ; `undefined` tant que le Sport n'est pas activé. */
  getProfile(): Promise<TrainingProfile | undefined>;
  saveProfile(profile: TrainingProfile): Promise<void>;
  getPlan(weekStart: IsoDate): Promise<SavedTrainingPlan | undefined>;
  /** Ajoute ou remplace le programme de la semaine `plan.weekStart`. */
  savePlan(plan: SavedTrainingPlan): Promise<void>;
  /** Historique des programmes, du plus récent au plus ancien. */
  listPlans(): Promise<readonly SavedTrainingPlan[]>;
}
