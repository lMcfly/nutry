import { SESSION_TEMPLATES } from './templates';
import {
  CAUTIOUS_MIN_REST_SECONDS,
  MIN_REST_SECONDS,
  MIN_SETS_WHEN_TRIMMED,
  SHORT_SESSION_MINUTES,
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

/**
 * Réglages du raccourcissement propres à la séance.
 * - `short` : séance de 20 min, un seul bloc suffit (`minBlocks` ramené à 1) ; le bloc gardé
 *   alterne d'une séance à l'autre parmi `SessionTemplate.shortBlocks` ;
 * - `rotation` : rang de la séance (séance de la semaine + semaines actives), qui décide du
 *   bloc gardé. Sans lui, le premier bloc.
 */
export interface TrimOptions {
  readonly short?: boolean;
  readonly rotation?: number;
}

/** Réglages d'une séance pour une durée cible (20 min : un bloc, en alternance). */
export function trimOptionsFor(minutes: number, rotation = 0): TrimOptions {
  return { short: minutes === SHORT_SESSION_MINUTES, rotation };
}

/** Vrai si le bloc équilibre des 70 ans et plus ouvre la séance (bloc 0). */
function startsWithBalance(
  session: DraftSession,
  blocksBySlot: Readonly<Record<string, number>>,
): boolean {
  return (
    session.kind !== 'douce' &&
    session.main.some(
      (item) => blockOf(item.slotId, blocksBySlot) === 0 && item.pattern === 'equilibre',
    )
  );
}

/**
 * Blocs gardés au minimum : ceux du gabarit (un seul pour 20 min), plus le bloc équilibre des
 * 70 ans et plus.
 */
function minimumBlocks(
  session: DraftSession,
  blocksBySlot: Readonly<Record<string, number>>,
  options: TrimOptions,
): number {
  const base = options.short ? 1 : SESSION_TEMPLATES[session.kind].minBlocks;
  return base + (startsWithBalance(session, blocksBySlot) ? 1 : 0);
}

/**
 * Bloc qui reste d'une séance courte : les blocs « autonomes » du gabarit (poussée et tirage,
 * ou genou et hanche, donc équilibrés à eux seuls) se relaient selon le rang de la séance.
 * Repli : le premier bloc de la séance qui reste.
 */
function shortBlockToKeep(
  session: DraftSession,
  present: readonly number[],
  offset: number,
  rotation: number,
): number {
  const candidates = SESSION_TEMPLATES[session.kind].shortBlocks
    .map((block) => block + offset)
    .filter((block) => present.includes(block));
  const pool = candidates.length > 0 ? candidates : present.filter((block) => block >= offset);
  return pool[Math.abs(rotation) % pool.length] ?? (present[0] as number);
}

/**
 * Applique les `level` premières étapes de raccourcissement, dans l'ordre de l'ADR :
 * 1 à 3 : retirer les accessoires du dernier bloc qui en a encore ;
 * 4 : ramener les séries à `MIN_SETS_WHEN_TRIMMED` ;
 * 5 et 6 : abandonner le dernier bloc, jusqu'au minimum du gabarit ; pour 20 min (`short`), le
 *     minimum est un seul bloc : on garde celui que désigne la rotation (alternance d'une
 *     séance à l'autre) et on abandonne les autres, le dernier d'abord ;
 * 7 : plafonner le repos à `MIN_REST_SECONDS` (45 s), ou à `CAUTIOUS_MIN_REST_SECONDS` (60 s)
 *     pour les exercices à 3 répétitions en réserve (débutant, ou intensité modérée :
 *     grossesse, post-partum, condition de santé). Seuil à faire valider par un professionnel.
 * Un même niveau a le même sens pour toutes les séances, ce qui garde les équilibres de la semaine.
 */
export function trimSession(
  session: DraftSession,
  blocksBySlot: Readonly<Record<string, number>>,
  level: number,
  options: TrimOptions = {},
): DraftSession {
  let main = session.main;
  const minBlocks = minimumBlocks(session, blocksBySlot, options);
  const balanceOffset = startsWithBalance(session, blocksBySlot) ? 1 : 0;
  const keepBlock = options.short
    ? shortBlockToKeep(
        session,
        [...new Set(session.main.map((item) => blockOf(item.slotId, blocksBySlot)))],
        balanceOffset,
        options.rotation ?? 0,
      )
    : undefined;
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
      const present = [...new Set(main.map((item) => blockOf(item.slotId, blocksBySlot)))].sort(
        (a, b) => a - b,
      );
      if (present.length <= minBlocks) continue;
      // Séance courte : on abandonne les blocs autres que celui que la rotation désigne (et que
      // le bloc équilibre) ; sinon, toujours le dernier.
      const droppable =
        keepBlock === undefined || !present.includes(keepBlock)
          ? present
          : present.filter((block) => block !== keepBlock && !(balanceOffset === 1 && block === 0));
      const last = Math.max(...(droppable.length > 0 ? droppable : present));
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
  rotation = 0,
): number {
  const limit = minutes * (1 + TIMING.overrunRatio);
  const options = trimOptionsFor(minutes, rotation);
  for (let level = 0; level < MAX_TRIM_LEVEL; level += 1) {
    if (estimateSessionMinutes(trimSession(session, blocksBySlot, level, options)) <= limit)
      return level;
  }
  return MAX_TRIM_LEVEL;
}

/** Séance raccourcie à ce niveau, avec sa durée estimée. */
export function applyTrimLevel(
  session: DraftSession,
  blocksBySlot: Readonly<Record<string, number>>,
  level: number,
  options: TrimOptions = {},
): PlannedSession {
  const trimmed = trimSession(session, blocksBySlot, level, options);
  return { ...trimmed, estimatedMinutes: estimateSessionMinutes(trimmed) };
}

/**
 * Ajuste la séance au temps cible : tant que l'estimation dépasse `minutes × 1,1`, retire les
 * accessoires, ramène les séries à 2, puis abandonne les blocs jusqu'à `minBlocks` (un seul à
 * 20 min, en alternance selon `rotation`). Si même ce plancher dépasse, la séance garde son
 * minimum (les équilibres priment).
 */
export function fitSessionToDuration(
  session: DraftSession,
  minutes: number,
  blocksBySlot: Readonly<Record<string, number>>,
  rotation = 0,
): PlannedSession {
  return applyTrimLevel(
    session,
    blocksBySlot,
    minimalTrimLevel(session, minutes, blocksBySlot, rotation),
    trimOptionsFor(minutes, rotation),
  );
}
