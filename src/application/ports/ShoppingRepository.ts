import type { IsoDate } from '@domain/shared';
import type { ShoppingRecord } from '@domain/userdata';

/** Persistance des cases cochées et des articles manuels, par semaine. */
export interface ShoppingRepository {
  get(weekStart: IsoDate): Promise<ShoppingRecord | undefined>;
  /** Ajoute ou remplace l'état de la semaine `record.weekStart`. */
  save(record: ShoppingRecord): Promise<void>;
}
