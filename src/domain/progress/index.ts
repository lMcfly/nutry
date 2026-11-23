export type { ProgressEntry, ProgressMetric } from './progress.types';
export {
  TREND_SMOOTHING,
  checkProgressEntry,
  computeTrend,
  recordProgress,
  summarizeProgress,
} from './progress';
export type { EntryCheck, ProgressSummary, RecordedProgress, TrendPoint } from './progress';
