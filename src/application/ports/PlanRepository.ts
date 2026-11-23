import type { IsoDate } from '@domain/shared';
import type { SavedPlan } from '@domain/userdata';

export interface PlanRepository {
  getByWeek(weekStart: IsoDate): Promise<SavedPlan | undefined>;
  /** Ajoute ou remplace le menu de la semaine `plan.weekStart`. */
  save(plan: SavedPlan): Promise<void>;
  /** Historique des menus, du plus récent au plus ancien. */
  list(): Promise<readonly SavedPlan[]>;
}
