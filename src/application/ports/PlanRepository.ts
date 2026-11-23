import type { WeeklyPlan } from '@domain/mealplan';
import type { IsoDate } from '@domain/shared';

export interface PlanRepository {
  getByWeek(weekStart: IsoDate): Promise<WeeklyPlan | undefined>;
  save(plan: WeeklyPlan): Promise<void>;
  /** Historique des menus, du plus récent au plus ancien. */
  list(): Promise<readonly WeeklyPlan[]>;
}
