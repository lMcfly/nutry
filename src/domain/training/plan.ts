import { addDays, startOfWeek, type IsoDate } from '../shared';
import { MAX_TRIM_LEVEL, applyTrimLevel, fitSessionToDuration, minimalTrimLevel } from './duration';
import { computeCycle } from './cycle';
import { TRAINING_NOTICES } from './notices';
import { avoidedExerciseIds } from './pain';
import { prescribe } from './progression';
import { assessTrainingSafety } from './safety';
import { isExerciseEligible, pickExercise, rankExercises } from './select';
import { SESSION_TEMPLATES, chooseSplit } from './templates';
import { weeklyVolumeByGroup } from './volume';
import {
  ALWAYS_AVAILABLE_EQUIPMENT,
  GENTLE_SESSION,
  HOLD_SECONDS,
  MUSCLE_GROUPS,
  PREFERRED_EQUIPMENT,
  RECOVERY_EXEMPT_PATTERNS,
  TIMING,
  WEEKLY_VOLUME,
  type MovementPattern,
  type MuscleGroup,
  type SessionKind,
  type SlotRole,
} from './training.constants';
import type {
  EligibilityContext,
  ExerciseHistoryEntry,
  PlanTrainingWeekInput,
} from './training.contracts';
import type {
  CycleInfo,
  Exercise,
  PlannedExercise,
  PlannedSession,
  Prescription,
  SessionBlock,
  SessionLog,
  SessionSlot,
  TrainingNotice,
  TrainingProfile,
  WeeklyTrainingPlan,
} from './training.types';

type Draft = Omit<PlannedSession, 'estimatedMinutes'>;

interface Placed {
  readonly slotId: string;
  readonly block: number;
  readonly order: number;
  readonly slot: SessionSlot;
}

const BALANCE_BLOCK: SessionBlock = [
  { pattern: 'equilibre', role: 'secondaire' },
  { pattern: 'mobilite', role: 'accessoire' },
];

const round5 = (seconds: number): number => Math.max(5, Math.round(seconds / 5) * 5);

/** Journaux antérieurs à la semaine, du plus ancien au plus récent, regroupés par exercice. */
function historyByExercise(
  logs: readonly SessionLog[],
  weekStart: IsoDate,
): ReadonlyMap<string, readonly ExerciseHistoryEntry[]> {
  const ordered = logs
    .filter((log) => log.weekStart < weekStart)
    .sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? -1 : 1));
  const map = new Map<string, ExerciseHistoryEntry[]>();
  for (const log of ordered) {
    for (const exercise of log.exercises) {
      const entries = map.get(exercise.exerciseId) ?? [];
      entries.push({ date: log.date, log: exercise });
      map.set(exercise.exerciseId, entries);
    }
  }
  return map;
}

/** Mouvement tenu d'échauffement ou de retour au calme (sans repos ni progression). */
function chainedMove(slotId: string, exercise: Exercise, seconds: number): PlannedExercise {
  const prescription: Prescription = {
    sets: 1,
    target: { measure: 'duree', minSeconds: seconds, maxSeconds: seconds },
    restSeconds: 0,
    advice: 'maintiens',
    repsInReserve: 0,
  };
  return {
    slotId,
    exerciseId: exercise.id,
    pattern: exercise.pattern,
    role: 'accessoire',
    unilateral: exercise.unilateral,
    prescription,
  };
}

function overlap(exercise: Exercise, groups: readonly MuscleGroup[]): number {
  return [...exercise.primaryMuscles, ...exercise.secondaryMuscles].filter((g) =>
    groups.includes(g),
  ).length;
}

/**
 * Séance douce : le cardio en une série continue, mobilité et équilibre en séries tenues.
 * Semaine allégée : une série de moins par mouvement tenu (arrondi au-dessus de la moitié).
 */
function gentlePrescription(
  exercise: Exercise,
  training: TrainingProfile,
  cycle: CycleInfo,
): Prescription {
  const cardio = exercise.pattern === 'cardio';
  const hold = HOLD_SECONDS[training.level];
  const sets = cardio ? 1 : cycle.deload ? 1 : GENTLE_SESSION.holdSets;
  return {
    sets,
    target: cardio
      ? {
          measure: 'duree',
          minSeconds: GENTLE_SESSION.cardioSeconds.min,
          maxSeconds: GENTLE_SESSION.cardioSeconds.max,
        }
      : { measure: 'duree', minSeconds: hold.min, maxSeconds: hold.max },
    restSeconds: cardio ? 0 : GENTLE_SESSION.holdRestSeconds,
    advice: cycle.deload ? 'semaine-allegee' : 'maintiens',
    repsInReserve: 3,
  };
}

/**
 * Programme déterministe d'une semaine (ADR 0015, section 4). Aucun aléa ni lecture de
 * l'heure : à entrée égale, sortie égale, quel que soit l'ordre du catalogue.
 * Deux écarts assumés avec le texte de l'ADR :
 * - le raccourcissement à la durée cible est **uniforme** sur les séances de renforcement
 *   (niveau le plus fort nécessaire à l'une d'elles), pour que poussée/tirage et genou/hanche
 *   restent équilibrés même si l'estimation diffère d'une séance à l'autre ;
 * - principal et secondaire sont choisis avant les accessoires pour que leur rotation ne
 *   dépende pas des accessoires, qui changent chaque semaine.
 */
export function planTrainingWeek(input: PlanTrainingWeekInput): WeeklyTrainingPlan {
  const { profile, training, catalog } = input;
  const weekStart = startOfWeek(input.weekStart);
  const safety = assessTrainingSafety(profile, training);
  const assignment = chooseSplit(training.days, safety.maxStrengthSessions);
  const cycle = computeCycle({
    level: training.level,
    weekStart,
    completedWeekStarts: input.logs
      .filter((log) => log.status === 'terminee')
      .map((log) => log.weekStart),
  });
  const avoided = avoidedExerciseIds(input.painReports, input.today);
  const equipment = [...new Set([...training.equipment, ...ALWAYS_AVAILABLE_EQUIPMENT])];
  const history = historyByExercise(input.logs, weekStart);
  const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));

  const contextFor = (pattern: MovementPattern, role: SlotRole): EligibilityContext => ({
    pattern,
    role,
    level: training.level,
    equipment,
    safety,
    avoidedExerciseIds: avoided,
  });
  const used: string[] = [];
  const missingSlots: MovementPattern[] = [];

  const pick = (pattern: MovementPattern, role: SlotRole): Exercise | undefined => {
    const context = contextFor(pattern, role);
    const eligible = catalog.filter((exercise) => isExerciseEligible(exercise, context));
    const ranked = rankExercises(eligible, {
      ...context,
      preferredEquipment: PREFERRED_EQUIPMENT[training.setting],
      usedThisWeek: used,
    });
    const chosen = pickExercise(ranked, role, cycle);
    if (chosen) used.push(chosen.id);
    else missingSlots.push(pattern);
    return chosen;
  };

  // Créneaux de chaque séance (bloc équilibre en tête pour les 70 ans et plus).
  const layouts = assignment.sessions.map((entry) => {
    const template = SESSION_TEMPLATES[entry.kind];
    const blocks =
      safety.includeBalance && entry.kind !== 'douce'
        ? [BALANCE_BLOCK, ...template.blocks]
        : template.blocks;
    const slots: Placed[] = blocks.flatMap((block, b) =>
      block.map((slot, order) => ({ slotId: `b${b}-s${order}`, block: b, order, slot })),
    );
    return { entry, template, slots };
  });

  // Passe 1 : principal et secondaire ; passe 2 : accessoires.
  const picks = layouts.map(() => new Map<string, Exercise>());
  for (const roles of [['principal', 'secondaire'], ['accessoire']] as const) {
    layouts.forEach((layout, index) => {
      for (const placed of layout.slots) {
        if (!(roles as readonly SlotRole[]).includes(placed.slot.role)) continue;
        const chosen = pick(placed.slot.pattern, placed.slot.role);
        if (chosen) picks[index]?.set(placed.slotId, chosen);
      }
    });
  }

  const gentleWarm = (kind: SessionKind): boolean => kind !== 'douce';
  const warmupSeconds =
    (training.sessionMinutes === 20 ? TIMING.warmupMinutes.short : TIMING.warmupMinutes.normal) *
    60;
  const cooldownSeconds =
    (training.sessionMinutes === 20
      ? TIMING.cooldownMinutes.short
      : TIMING.cooldownMinutes.normal) * 60;

  const rankedFor = (pattern: MovementPattern, groups: readonly MuscleGroup[]): Exercise[] => {
    const context = contextFor(pattern, 'accessoire');
    return rankExercises(
      catalog.filter((exercise) => isExerciseEligible(exercise, context)),
      { ...context, preferredEquipment: [], usedThisWeek: [] },
    )
      .map((exercise, index) => ({ exercise, index, hits: overlap(exercise, groups) }))
      .sort((a, b) => b.hits - a.hits || a.index - b.index)
      .map((entry) => entry.exercise);
  };

  const drafts: { draft: Draft; blocks: Record<string, number>; strength: boolean }[] = layouts.map(
    (layout, index) => {
      const { entry, template, slots } = layout;
      const chosen = picks[index] as Map<string, Exercise>;
      const blocks: Record<string, number> = {};
      const main: PlannedExercise[] = [];
      for (const placed of slots) {
        const exercise = chosen.get(placed.slotId);
        if (!exercise) continue;
        blocks[placed.slotId] = placed.block;
        const prescription =
          entry.kind === 'douce'
            ? gentlePrescription(exercise, training, cycle)
            : prescribe({
                exercise,
                role: placed.slot.role,
                goal: training.goal,
                level: training.level,
                safety,
                cycle,
                history: history.get(exercise.id) ?? [],
              });
        main.push({
          slotId: placed.slotId,
          exerciseId: exercise.id,
          pattern: placed.slot.pattern,
          role: placed.slot.role,
          unilateral: exercise.unilateral,
          prescription,
        });
      }

      // Échauffement : cardio doux puis mobilité des groupes du jour ; retour au calme : mobilité.
      let warmup: PlannedExercise[] = [];
      let cooldown: PlannedExercise[] = [];
      if (gentleWarm(entry.kind)) {
        const dayGroups = MUSCLE_GROUPS.filter((group) =>
          main.some((item) => byId.get(item.exerciseId)?.primaryMuscles.includes(group)),
        );
        const cardio = pickExercise(rankedFor('cardio', []), 'accessoire', cycle);
        const mobility = rankedFor('mobilite', dayGroups);
        const warmMoves = mobility.slice(0, 3);
        const cardioSeconds = cardio
          ? warmMoves.length > 0
            ? warmupSeconds * 0.4
            : warmupSeconds
          : 0;
        warmup = [];
        if (cardio) warmup.push(chainedMove('w0', cardio, round5(cardioSeconds)));
        warmMoves.forEach((exercise, i) => {
          warmup.push(
            chainedMove(
              `w${i + 1}`,
              exercise,
              round5((warmupSeconds - cardioSeconds) / warmMoves.length),
            ),
          );
        });
        const rest = mobility.filter((exercise) => !warmMoves.includes(exercise));
        const calm = (rest.length > 0 ? rest : mobility).slice(0, 2);
        cooldown = calm.map((exercise, i) =>
          chainedMove(`c${i}`, exercise, round5(cooldownSeconds / calm.length)),
        );
      }

      const draft: Draft = {
        id: `d${entry.dayIndex}`,
        dayIndex: entry.dayIndex,
        date: addDays(weekStart, entry.dayIndex),
        kind: entry.kind,
        title: template.title,
        warmup,
        main,
        cooldown,
        heavyGroups: [],
      };
      return { draft, blocks, strength: entry.kind !== 'douce' };
    },
  );

  // Durée cible : niveau de raccourcissement commun aux séances de renforcement.
  const strengthLevel = Math.max(
    0,
    ...drafts
      .filter((d) => d.strength)
      .map((d) => minimalTrimLevel(d.draft, training.sessionMinutes, d.blocks)),
  );
  const build = (level: number): PlannedSession[] =>
    drafts.map(({ draft, blocks, strength }) => {
      const fitted = strength
        ? applyTrimLevel(draft, blocks, level)
        : fitSessionToDuration(draft, training.sessionMinutes, blocks);
      const groups = new Set<MuscleGroup>();
      for (const item of fitted.main) {
        if (RECOVERY_EXEMPT_PATTERNS.includes(item.pattern)) continue;
        for (const group of byId.get(item.exerciseId)?.primaryMuscles ?? []) groups.add(group);
      }
      return { ...fitted, heavyGroups: MUSCLE_GROUPS.filter((group) => groups.has(group)) };
    });

  // Plafond de volume par groupe : même ladder de raccourcissement, donc mêmes équilibres.
  const volumeCap = WEEKLY_VOLUME[training.level].max;
  const overCap = (candidate: readonly PlannedSession[]): boolean => {
    const volume = weeklyVolumeByGroup(
      { weekStart, split: assignment.split, cycle, sessions: candidate, notices: [] },
      catalog,
    );
    return MUSCLE_GROUPS.some((group) => volume[group] > volumeCap);
  };
  let trimLevel = strengthLevel;
  let sessions = build(trimLevel);
  while (trimLevel < MAX_TRIM_LEVEL && overCap(sessions)) {
    trimLevel += 1;
    sessions = build(trimLevel);
  }

  const notices: TrainingNotice[] = [];
  const notice = (code: TrainingNotice['code']): void => {
    notices.push({ code, message: TRAINING_NOTICES[code] });
  };
  if (assignment.tooClose) notice('jours-rapproches');
  if (assignment.capped) notice('seances-plafonnees');
  if (missingSlots.length > 0) notice('catalogue-insuffisant');
  if (cycle.deload) notice(cycle.deloadReason === 'reprise' ? 'reprise' : 'semaine-allegee');

  return { weekStart, split: assignment.split, cycle, sessions, notices };
}
