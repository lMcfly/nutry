import { SESSION_TEMPLATES } from './templates';
import {
  CAUTIOUS_MIN_REST_SECONDS,
  MIN_REST_SECONDS,
  MIN_SETS_WHEN_TRIMMED,
  TIMING,
} from './training.constants';
import type { PlannedExercise, PlannedSession, SetTarget } from './training.types';

type DraftSession = Omit<PlannedSession, 'estimatedMinutes'>;

/** Secondes de travail d'une série : milieu de la fourchette (× durée d'une répétition). */
function workSeconds(target: SetTarget): number {
  return target.measure === 'repetitions'
    ? ((target.minReps + target.maxReps) / 2) * TIMING.secondsPerRep
    : (target.minSeconds + target.maxSeconds) / 2;
}

function exerciseSeconds(item: PlannedExercise): number {
  const { sets, target, restSeconds } = item.prescription;
  const work = workSeconds(target) * (item.unilateral ? 2 : 1);
  return TIMING.transitionSeconds + sets * (work + restSeconds);
}

/** Échauffement et retour au calme : leurs mouvements sont enchaînés sans transition ni repos. */
function chainedSeconds(items: readonly PlannedExercise[]): number {
  return items.reduce(
    (total, item) => total + item.prescription.sets * workSeconds(item.prescription.target),
    0,
  );
}

/**
 * Durée estimée, arrondie à la minute : échauffement et retour au calme (leurs durées
 * prescrites, qui suivent `TIMING`) + pour chaque exercice une transition, puis par série le
 * travail (répétitions moyennes × `secondsPerRep`, ou secondes tenues, doublé si unilatéral)
 * et le repos.
 */
export function estimateSessionMinutes(session: DraftSession): number {
  const seconds =
    chainedSeconds(session.warmup) +
    chainedSeconds(session.cooldown) +
    session.main.reduce((total, item) => total + exerciseSeconds(item), 0);
  return Math.round(seconds / 60);
}

/** Étapes de raccourcissement : 3 retraits d'accessoires, séries, 2 blocs, repos. */
const ACCESSORY_STEPS = 3;
const SETS_STEP = ACCESSORY_STEPS + 1;
const LAST_BLOCK_STEP = SETS_STEP + 2;
export const MAX_TRIM_LEVEL = LAST_BLOCK_STEP + 1;

function blockOf(slotId: string, blocksBySlot: Readonly<Record<string, number>>): number {
  return blocksBySlot[slotId] ?? 0;
}

/** Blocs gardés au minimum : ceux du gabarit, plus le bloc équilibre des 70 ans et plus. */
function minimumBlocks(
  session: DraftSession,
  blocksBySlot: Readonly<Record<string, number>>,
): number {
  const balanceFirst =
    session.kind !== 'douce' &&
    session.main.some(
      (item) => blockOf(item.slotId, blocksBySlot) === 0 && item.pattern === 'equilibre',
    );
  return SESSION_TEMPLATES[session.kind].minBlocks + (balanceFirst ? 1 : 0);
}

/**
 * Applique les `level` premières étapes de raccourcissement, dans l'ordre de l'ADR :
 * 1 à 3 : retirer les accessoires du dernier bloc qui en a encore ;
 * 4 : ramener les séries à `MIN_SETS_WHEN_TRIMMED` ;
 * 5 et 6 : abandonner le dernier bloc, jusqu'au minimum du gabarit ;
 * 7 : plafonner le repos à `MIN_REST_SECONDS` (45 s), ou à `CAUTIOUS_MIN_REST_SECONDS` (60 s)
 *     pour les exercices à 3 répétitions en réserve (débutant, ou intensité modérée :
 *     grossesse, post-partum, condition de santé). Seuil à faire valider par un professionnel.
 * Un même niveau a le même sens pour toutes les séances, ce qui garde les équilibres de la semaine.
 */
export function trimSession(
  session: DraftSession,
  blocksBySlot: Readonly<Record<string, number>>,
  level: number,
): DraftSession {
  let main = session.main;
  const minBlocks = minimumBlocks(session, blocksBySlot);
  for (let step = 1; step <= level; step += 1) {
    if (step <= ACCESSORY_STEPS) {
      const blocks = main
        .filter((item) => item.role === 'accessoire')
        .map((item) => blockOf(item.slotId, blocksBySlot));
      if (blocks.length === 0) continue;
      const last = Math.max(...blocks);
      main = main.filter(
        (item) => !(item.role === 'accessoire' && blockOf(item.slotId, blocksBySlot) === last),
      );
    } else if (step === SETS_STEP) {
      main = main.map((item) =>
        item.prescription.sets > MIN_SETS_WHEN_TRIMMED
          ? { ...item, prescription: { ...item.prescription, sets: MIN_SETS_WHEN_TRIMMED } }
          : item,
      );
    } else if (step === MAX_TRIM_LEVEL) {
      main = main.map((item) => {
        const floor =
          item.prescription.repsInReserve >= 3 ? CAUTIOUS_MIN_REST_SECONDS : MIN_REST_SECONDS;
        return item.prescription.restSeconds <= floor
          ? item
          : { ...item, prescription: { ...item.prescription, restSeconds: floor } };
      });
    } else {
      const present = [...new Set(main.map((item) => blockOf(item.slotId, blocksBySlot)))];
      if (present.length <= minBlocks) continue;
      const last = Math.max(...present);
      main = main.filter((item) => blockOf(item.slotId, blocksBySlot) !== last);
    }
  }
  return { ...session, main };
}

/** Plus petit niveau de raccourcissement qui tient dans `minutes` + tolérance (sinon le maximum). */
export function minimalTrimLevel(
  session: DraftSession,
  minutes: number,
  blocksBySlot: Readonly<Record<string, number>>,
): number {
  const limit = minutes * (1 + TIMING.overrunRatio);
  for (let level = 0; level < MAX_TRIM_LEVEL; level += 1) {
    if (estimateSessionMinutes(trimSession(session, blocksBySlot, level)) <= limit) return level;
  }
  return MAX_TRIM_LEVEL;
}

/** Séance raccourcie à ce niveau, avec sa durée estimée. */
export function applyTrimLevel(
  session: DraftSession,
  blocksBySlot: Readonly<Record<string, number>>,
  level: number,
): PlannedSession {
  const trimmed = trimSession(session, blocksBySlot, level);
  return { ...trimmed, estimatedMinutes: estimateSessionMinutes(trimmed) };
}

/**
 * Ajuste la séance au temps cible : tant que l'estimation dépasse `minutes × 1,1`, retire les
 * accessoires, ramène les séries à 2, puis abandonne les derniers blocs jusqu'à `minBlocks`.
 * Si même ce plancher dépasse, la séance garde son minimum (les équilibres priment).
 */
export function fitSessionToDuration(
  session: DraftSession,
  minutes: number,
  blocksBySlot: Readonly<Record<string, number>>,
): PlannedSession {
  return applyTrimLevel(session, blocksBySlot, minimalTrimLevel(session, minutes, blocksBySlot));
}
