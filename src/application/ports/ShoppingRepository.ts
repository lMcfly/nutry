import type { IsoDate } from '@domain/shared';
import type { ShoppingState } from '@domain/shopping';

/** Persistance des cases cochées et des articles manuels, par semaine. */
export interface ShoppingRepository {
  getState(weekStart: IsoDate): Promise<ShoppingState | undefined>;
  saveState(weekStart: IsoDate, state: ShoppingState): Promise<void>;
}
