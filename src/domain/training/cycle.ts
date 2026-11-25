import { daysBetween, startOfWeek, type IsoDate } from '../shared';
import {
  DELOAD_EVERY_WEEKS,
  RETURN_AFTER_BREAK_WEEKS,
  type TrainingLevel,
} from './training.constants';
import type { CycleInfo } from './training.types';

/**
 * Position de la semaine `weekStart` dans le cycle de progression (ADR 0015, étape 6).
 * - Semaines actives = semaines (lundis) avant `weekStart` avec au moins une séance terminée.
 * - Bloc de `DELOAD_EVERY_WEEKS[level]` semaines actives, la dernière allégée.
 * - Reprise : après `RETURN_AFTER_BREAK_WEEKS` semaines entières sans séance terminée depuis
 *   la dernière semaine active, la semaine est allégée aussi (`deloadReason: 'reprise'`,
 *   prioritaire sur le cycle). Sans historique, ce n'est pas une reprise.
 */
export function computeCycle(input: {
  readonly level: TrainingLevel;
  readonly weekStart: IsoDate;
  readonly completedWeekStarts: readonly IsoDate[];
}): CycleInfo {
  const monday = startOfWeek(input.weekStart);
  const past = [...new Set(input.completedWeekStarts.map(startOfWeek))]
    .filter((week) => week < monday)
    .sort();
  const activeWeeks = past.length;
  const blockLength = DELOAD_EVERY_WEEKS[input.level];
  const weekInBlock = (activeWeeks % blockLength) + 1;
  const last = past[past.length - 1];
  const idleWeeks = last === undefined ? 0 : daysBetween(last, monday) / 7 - 1;
  const base = {
    activeWeeks,
    blockIndex: Math.floor(activeWeeks / blockLength),
    weekInBlock,
    blockLength,
  };
  if (idleWeeks >= RETURN_AFTER_BREAK_WEEKS) {
    return { ...base, deload: true, deloadReason: 'reprise' };
  }
  if (weekInBlock === blockLength) return { ...base, deload: true, deloadReason: 'cycle' };
  return { ...base, deload: false };
}
