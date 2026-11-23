import type { RatingRecord } from '@domain/userdata';

export interface RatingRepository {
  /** Ajoute l'avis, ou remplace celui de même `id` (un avis par repas). */
  save(rating: RatingRecord): Promise<void>;
  /** Tous les avis, du plus ancien au plus récent. */
  getAll(): Promise<readonly RatingRecord[]>;
  /** Supprime un avis (sans effet s'il n'existe pas). */
  remove(id: string): Promise<void>;
}
