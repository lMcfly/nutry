import { roundTo } from '../shared';
import { loadEquipmentOf } from './select';
import {
  ACCESSORY_REP_BONUS,
  ACCESSORY_REST_REDUCTION_SECONDS,
  ASSISTED_ID_PATTERN,
  BODYWEIGHT_REP_CEILING,
  DELOAD,
  HOLD_REST_SECONDS,
  HOLD_SECONDS,
  LOAD_DECREASE_RATIO,
  LOAD_INCREMENT_KG,
  MIN_REST_SECONDS,
  MIN_SETS_WHEN_TRIMMED,
  REP_SCHEMES,
  SETS_BY_ROLE,
  type SlotRole,
  type TrainingGoal,
  type TrainingLevel,
} from './training.constants';
import type { ExerciseHistoryEntry } from './training.contracts';
import type {
  CycleInfo,
  Exercise,
  Prescription,
  SetTarget,
  TrainingSafety,
} from './training.types';

/** Ce qu'une séance passée dit d'un exercice : valeurs mesurées des séries faites, charge. */
interface Performance {
  /** Répétitions (ou secondes) de chaque série faite et mesurée. */
  readonly values: readonly number[];
  /** Plus petite charge utilisée sur les séries faites (prudence), si elle est connue. */
  readonly loadKg?: number;
}

function performanceOf(entry: ExerciseHistoryEntry, exercise: Exercise): Performance | undefined {
  const done = entry.log.sets.filter((set) => entry.log.done || set.done);
  const values = done
    .map((set) => (exercise.measure === 'duree' ? set.seconds : set.reps))
    .filter((value): value is number => value !== undefined);
  if (values.length === 0) return undefined;
  const loads = done.map((set) => set.loadKg).filter((load): load is number => load !== undefined);
  return loads.length > 0 ? { values, loadKg: Math.min(...loads) } : { values };
}

/** Séries prévues pour un rôle et un niveau (semaine normale). */
export function plannedSets(role: SlotRole, level: TrainingLevel): number {
  return SETS_BY_ROLE[role][level];
}

/** Fourchette de la série pour cet exercice, avant toute progression. */
function baseTarget(
  exercise: Exercise,
  role: SlotRole,
  goal: TrainingGoal,
  level: TrainingLevel,
  safety: TrainingSafety,
): { readonly target: SetTarget; readonly restSeconds: number } {
  if (exercise.measure === 'duree') {
    const hold = HOLD_SECONDS[level];
    return {
      target: { measure: 'duree', minSeconds: hold.min, maxSeconds: hold.max },
      restSeconds: HOLD_REST_SECONDS,
    };
  }
  const scheme = REP_SCHEMES[goal];
  const bonus = role === 'accessoire' ? ACCESSORY_REP_BONUS : 0;
  const minReps = Math.max(scheme.minReps, safety.minReps);
  const maxReps = Math.max(scheme.maxReps, minReps + 2);
  const restSeconds =
    role === 'accessoire'
      ? Math.max(MIN_REST_SECONDS, scheme.restSeconds - ACCESSORY_REST_REDUCTION_SECONDS)
      : scheme.restSeconds;
  return {
    target: { measure: 'repetitions', minReps: minReps + bonus, maxReps: maxReps + bonus },
    restSeconds,
  };
}

const bounds = (target: SetTarget): { low: number; high: number } =>
  target.measure === 'repetitions'
    ? { low: target.minReps, high: target.maxReps }
    : { low: target.minSeconds, high: target.maxSeconds };

/**
 * Double progression (ADR 0015, étape 9). Ordre des règles :
 * 1. semaine allégée : séries × 0,5 (arrondi au-dessus), charge × 0,9, aucune progression ;
 * 2. exercice chargé sans historique mesuré : « Trouve ta charge » ;
 * 3. deux séances de suite où aucune série n'atteint la borne basse : charge × 0,9 (« allège ») ;
 * 4. toutes les séries à la borne haute : charge + incrément (retour à la borne basse), ou, au
 *    poids du corps, à l'élastique ou en assisté, borne haute + 2 jusqu'à 20 puis « variante
 *    plus dure » ; sans progression de charge autorisée (grossesse, post-partum, condition de
 *    santé) : « Maintiens » ;
 * 4 bis. exercice en durée : borne haute tenue partout → variante plus dure ou « maintiens » ;
 * 5. sinon « Ajoute une répétition » (ou un peu plus de temps pour un exercice en durée).
 */
export function prescribe(input: {
  readonly exercise: Exercise;
  readonly role: SlotRole;
  readonly goal: TrainingGoal;
  readonly level: TrainingLevel;
  readonly safety: TrainingSafety;
  readonly cycle: CycleInfo;
  readonly history: readonly ExerciseHistoryEntry[];
}): Prescription {
  const { exercise, role, goal, level, safety, cycle } = input;
  const base = baseTarget(exercise, role, goal, level, safety);
  const baseSets = plannedSets(role, level);
  const repsInReserve = safety.intensity === 'moderee' || level === 'debutant' ? 3 : 2;
  const performances = input.history
    .map((entry) => performanceOf(entry, exercise))
    .filter((p): p is Performance => p !== undefined);
  const last = performances[performances.length - 1];
  const before = performances[performances.length - 2];
  const loadEquipment = ASSISTED_ID_PATTERN.test(exercise.id)
    ? undefined
    : loadEquipmentOf(exercise);
  const loaded = loadEquipment !== undefined && exercise.measure === 'repetitions';
  const { low, high } = bounds(base.target);

  const make = (
    advice: Prescription['advice'],
    extra: { sets?: number; target?: SetTarget; loadKg?: number } = {},
  ): Prescription => ({
    sets: extra.sets ?? baseSets,
    target: extra.target ?? base.target,
    restSeconds: base.restSeconds,
    ...(extra.loadKg !== undefined ? { loadKg: extra.loadKg } : {}),
    advice,
    repsInReserve,
  });
  const lastLoad = loaded ? last?.loadKg : undefined;

  if (cycle.deload) {
    const sets = Math.max(1, Math.ceil(baseSets * DELOAD.setsRatio));
    return make('semaine-allegee', {
      sets,
      ...(lastLoad !== undefined ? { loadKg: roundTo(lastLoad * DELOAD.loadRatio, 0.5) } : {}),
    });
  }
  if (last === undefined) return make(loaded ? 'trouve-ta-charge' : 'ajoute-une-repetition');

  const failed = (p: Performance | undefined): boolean =>
    p !== undefined && Math.max(...p.values) < low;
  const atTop = last.values.length >= MIN_SETS_WHEN_TRIMMED && Math.min(...last.values) >= high;

  if (loaded && lastLoad === undefined) return make('trouve-ta-charge');
  if (failed(last) && failed(before)) {
    return make('allege', {
      ...(lastLoad !== undefined ? { loadKg: roundTo(lastLoad * LOAD_DECREASE_RATIO, 0.5) } : {}),
    });
  }

  if (loaded && lastLoad !== undefined) {
    if (!atTop) return make('ajoute-une-repetition', { loadKg: lastLoad });
    if (!safety.loadProgression) return make('maintiens', { loadKg: lastLoad });
    const step = LOAD_INCREMENT_KG[loadEquipment] ?? 0;
    return make('augmente-la-charge', { loadKg: roundTo(lastLoad + step, 0.5) });
  }

  if (exercise.measure === 'duree') {
    if (!atTop) return make('ajoute-une-repetition');
    return make(
      exercise.harderId !== undefined && safety.loadProgression
        ? 'variante-plus-dure'
        : 'maintiens',
    );
  }

  // Poids du corps, élastique, assisté : on monte la borne haute de 2, jusqu'à 20.
  const bestFloor = Math.min(...last.values);
  if (last.values.length < MIN_SETS_WHEN_TRIMMED) return make('ajoute-une-repetition');
  if (bestFloor >= BODYWEIGHT_REP_CEILING) {
    return make(
      exercise.harderId !== undefined && safety.loadProgression
        ? 'variante-plus-dure'
        : 'maintiens',
    );
  }
  if (bestFloor >= high) {
    if (!safety.loadProgression) return make('maintiens');
    const newHigh = Math.min(bestFloor + 2, BODYWEIGHT_REP_CEILING);
    return make('ajoute-une-repetition', {
      target: { measure: 'repetitions', minReps: low, maxReps: newHigh },
    });
  }
  return make('ajoute-une-repetition');
}
