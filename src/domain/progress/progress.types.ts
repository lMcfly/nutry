import type { IsoDate } from '../shared';

/** Mesure de suivi optionnelle (au plus une par semaine). */
export interface ProgressEntry {
  readonly date: IsoDate;
  readonly weightKg?: number;
  readonly waistCm?: number;
}

export type ProgressMetric = 'weightKg' | 'waistCm';
