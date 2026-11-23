import type { ProgressEntry } from '@domain/progress';
import type { IsoDate } from '@domain/shared';

export interface ProgressRepository {
  /** Ajoute ou remplace la mesure de la même date. */
  save(entry: ProgressEntry): Promise<void>;
  /** Mesures triées par date croissante. */
  list(): Promise<readonly ProgressEntry[]>;
  /** Supprime la mesure de cette date (sans effet si elle n'existe pas). */
  remove(date: IsoDate): Promise<void>;
}
