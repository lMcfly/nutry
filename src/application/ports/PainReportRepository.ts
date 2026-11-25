import type { PainReport } from '@domain/training';

/** Signalements « Ça fait mal » (un par jour et par exercice). */
export interface PainReportRepository {
  save(report: PainReport): Promise<void>;
  /** Tous les signalements, du plus ancien au plus récent. */
  list(): Promise<readonly PainReport[]>;
}
