import {
  ALWAYS_AVAILABLE_EQUIPMENT,
  GUIDED_EQUIPMENT,
  GUIDED_EQUIPMENT_BONUS,
  LOAD_INCREMENT_KG,
  PATTERN_KIND,
  PATTERN_PRIMARY_GROUPS,
  ROTATION_POOL,
  SHORT_SESSION_UNILATERAL_PENALTY,
  TRAINING_LEVELS,
  type Equipment,
  type SlotRole,
  type TrainingLevel,
} from './training.constants';
import type { EligibilityContext } from './training.contracts';
import type { CycleInfo, Exercise } from './training.types';

const levelRank = (level: TrainingLevel): number => TRAINING_LEVELS.indexOf(level);

/**
 * Filtre dur (ADR 0015, étape 7) : même schéma, matériel requis disponible, niveau de
 * l'exercice au plus égal à celui de la personne, aucune étiquette exclue, pas écarté pour
 * douleur, nature et muscles principaux permis par le schéma. Tout exercice proposé, pour le
 * programme, un remplacement ou une douleur, passe par ici.
 */
export function isExerciseEligible(exercise: Exercise, context: EligibilityContext): boolean {
  return (
    exercise.pattern === context.pattern &&
    exercise.kind === PATTERN_KIND[exercise.pattern] &&
    exercise.equipment.every(
      (item) => context.equipment.includes(item) || ALWAYS_AVAILABLE_EQUIPMENT.includes(item),
    ) &&
    levelRank(exercise.level) <= levelRank(context.level) &&
    !exercise.tags.some((tag) => context.safety.excludedTags.includes(tag)) &&
    !context.avoidedExerciseIds.includes(exercise.id) &&
    exercise.primaryMuscles.every((group) =>
      PATTERN_PRIMARY_GROUPS[exercise.pattern].includes(group),
    )
  );
}

/** Contexte de classement : éligibilité, plus ce qui départage les candidats. */
export type RankContext = EligibilityContext & {
  readonly preferredEquipment: readonly Equipment[];
  readonly usedThisWeek: readonly string[];
  /** Séance courte : les exercices unilatéraux (durée doublée) passent après les autres. */
  readonly shortSession?: boolean;
};

function score(exercise: Exercise, context: RankContext): number {
  let total = 0;
  if (
    context.role === 'principal' &&
    exercise.equipment.some((item) => context.preferredEquipment.includes(item))
  ) {
    total += 3;
  }
  if (
    context.level === 'debutant' &&
    context.role !== 'accessoire' &&
    exercise.equipment.some((item) => GUIDED_EQUIPMENT.includes(item))
  ) {
    total += GUIDED_EQUIPMENT_BONUS;
  }
  if (exercise.level === context.level) total += 1;
  total -= 2 * exercise.tags.filter((tag) => context.safety.discouragedTags.includes(tag)).length;
  if (context.usedThisWeek.includes(exercise.id)) total -= 5;
  if (context.shortSession === true && exercise.unilateral) {
    total -= SHORT_SESSION_UNILATERAL_PENALTY;
  }
  return total;
}

/**
 * Classement déterministe des exercices éligibles : +3 matériel préféré du cadre (créneau
 * principal), +4 machine guidée pour un débutant (créneaux principal et secondaire), +1 niveau
 * égal, −2 par étiquette déconseillée, −5 déjà utilisé dans la semaine, −1 unilatéral en séance courte
 * (30 min ou moins) ; égalité : `id`.
 */
export function rankExercises(candidates: readonly Exercise[], context: RankContext): Exercise[] {
  return candidates
    .map((exercise) => ({ exercise, points: score(exercise, context) }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        (a.exercise.id < b.exercise.id ? -1 : a.exercise.id > b.exercise.id ? 1 : 0),
    )
    .map((entry) => entry.exercise);
}

/**
 * Rotation : principal et secondaire gardent le même exercice pendant tout un bloc
 * (`ranked[blockIndex mod min(n, ROTATION_POOL)]`, sinon la progression n'a pas de sens) ;
 * l'accessoire tourne chaque semaine active (`ranked[activeWeeks mod min(n, ROTATION_POOL)]`).
 */
export function pickExercise(
  ranked: readonly Exercise[],
  role: SlotRole,
  cycle: CycleInfo,
): Exercise | undefined {
  if (ranked.length === 0) return undefined;
  const pool = Math.min(ranked.length, ROTATION_POOL);
  const turn = role === 'accessoire' ? cycle.activeWeeks : cycle.blockIndex;
  return ranked[turn % pool];
}

/** Vrai si l'exercice se charge (haltères, barre, machine…) : sa charge progresse par paliers. */
export function isLoadedExercise(exercise: Exercise): boolean {
  return loadEquipmentOf(exercise) !== undefined;
}

/** Premier matériel de l'exercice qui porte une charge réglable. */
export function loadEquipmentOf(exercise: Exercise): Equipment | undefined {
  return exercise.equipment.find((item) => LOAD_INCREMENT_KG[item] !== undefined);
}

/**
 * Jusqu'à 3 remplaçants du même schéma, éligibles, sans l'exercice d'origine.
 * - `choix` : classement habituel.
 * - `douleur` : d'abord la variante `easierId` (seule dispensée du filtre d'étiquettes), puis les exercices sans charge, puis ceux d'un
 *   niveau plus bas, puis les autres ; sans une étiquette de l'exercice douloureux. Les
 *   exclusions de sécurité restent toujours dures.
 */
export function findAlternatives(input: {
  readonly exercise: Exercise;
  readonly reason: 'choix' | 'douleur';
  readonly catalog: readonly Exercise[];
  readonly context: EligibilityContext;
}): Exercise[] {
  const { exercise, reason, catalog } = input;
  const context = { ...input.context, pattern: exercise.pattern };
  let pool = catalog.filter(
    (candidate) => candidate.id !== exercise.id && isExerciseEligible(candidate, context),
  );
  if (reason === 'douleur') {
    pool = pool.filter(
      (candidate) =>
        candidate.id === exercise.easierId ||
        !candidate.tags.some((tag) => exercise.tags.includes(tag)),
    );
  }
  const ranked = rankExercises(pool, { ...context, preferredEquipment: [], usedThisWeek: [] });
  if (reason === 'choix') return ranked.slice(0, 3);
  const tier = (candidate: Exercise): number => {
    if (candidate.id === exercise.easierId) return 0;
    if (!isLoadedExercise(candidate)) return 1;
    if (levelRank(candidate.level) < levelRank(exercise.level)) return 2;
    return 3;
  };
  return ranked
    .map((candidate, index) => ({ candidate, index, tier: tier(candidate) }))
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .slice(0, 3)
    .map((entry) => entry.candidate);
}
