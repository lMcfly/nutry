import type { IsoDate } from '@domain/shared';
import type { SessionLog } from '@domain/training';

/** Journaux de séance (une séance prévue = un journal, `id` = `semaine:séance`). */
export interface SessionLogRepository {
  get(id: string): Promise<SessionLog | undefined>;
  /** Ajoute ou remplace le journal. */
  save(log: SessionLog): Promise<void>;
  listByWeek(weekStart: IsoDate): Promise<readonly SessionLog[]>;
  /** Tous les journaux, du plus ancien au plus récent. */
  listAll(): Promise<readonly SessionLog[]>;
}
