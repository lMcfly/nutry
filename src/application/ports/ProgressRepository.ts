import type { ProgressEntry } from '@domain/progress';

export interface ProgressRepository {
  /** Ajoute ou remplace la mesure de la même date. */
  save(entry: ProgressEntry): Promise<void>;
  /** Mesures triées par date croissante. */
  list(): Promise<readonly ProgressEntry[]>;
}
