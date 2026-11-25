/**
 * Propriétés du planificateur sur de nombreuses combinaisons (jours, niveaux, matériels,
 * durées, objectifs, profils santé, états du cycle), vérifiées contre un catalogue donné :
 * les fixtures du domaine (`plan.test.ts`) ou le vrai catalogue embarqué (test d'intégration
 * de l'infrastructure). Jamais importé par le code de production.
 */
import type { DayIndex } from '../mealplan';
import type { Profile } from '../profile';
import { addDays } from '../shared';
import {
  BALANCE_RULES,
  DELOAD_EVERY_WEEKS,
  EQUIPMENT_BY_SETTING,
  MIN_RECOVERY_DAYS,
  PULL_PATTERNS,
  PUSH_PATTERNS,
  RECOVERY_EXEMPT_PATTERNS,
  SESSION_TEMPLATES,
  SHORT_SESSION_MINUTES,
  TIMING,
  TRAINING_LEVELS,
  WEEKLY_VOLUME,
  assessTrainingSafety,
  cyclicDayGap,
  estimateSessionMinutes,
  planTrainingWeek,
  weeklySetsByPattern,
  weeklyVolumeByGroup,
  type Equipment,
  type EquipmentSetting,
  type Exercise,
  type ExerciseTag,
  type MuscleGroup,
  type PlanTrainingWeekInput,
  type SessionDuration,
  type SessionLog,
  type TrainingGoal,
  type TrainingLevel,
  type TrainingProfile,
  type WeeklyTrainingPlan,
} from '../training';
import { WEEK, makePlanInput, makeTraining } from './training.fixtures';

// ------------------------------------------------------------------ Oracles

/** Exclusions attendues, indépendantes de `SAFETY_EXCLUDED_TAGS` (tableau de l'ADR 0015, section 5). */
function oracleExcluded(profile: Profile, training: TrainingProfile): Set<ExerciseTag> {
  const out = new Set<ExerciseTag>();
  const add = (...tags: ExerciseTag[]): void => {
    for (const t of tags) out.add(t);
  };
  if (profile.pregnantOrBreastfeeding && profile.sex !== 'homme') {
    const stage = training.pregnancyStage ?? 'apres-premier-trimestre';
    if (stage === 'post-partum') add('impact', 'haute-intensite', 'flexion-tronc');
    else {
      add(
        'impact',
        'haute-intensite',
        'allonge-ventre',
        'flexion-tronc',
        'instable',
        'charge-axiale',
      );
      if (stage === 'apres-premier-trimestre') add('allonge-dos');
    }
  }
  if (profile.healthCondition) add('impact', 'haute-intensite');
  if (profile.age >= 70) add('impact', 'haute-intensite', 'instable', 'charge-axiale');
  if (profile.age < 18) add('charge-axiale');
  return out;
}

/** Dépassement toléré (× cible) d'une séance de 70 ans et plus déjà à son plancher de blocs. */
export const SENIOR_FLOOR_OVERRUN = 1.3;

export const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
};

export const logOf = (weekStart: string, id = 'd0'): SessionLog => ({
  id: `${weekStart}:${id}`,
  weekStart,
  sessionId: id,
  date: weekStart,
  status: 'terminee',
  startedAt: `${weekStart}T18:00:00`,
  completedAt: `${weekStart}T18:40:00`,
  exercises: [],
});
const weeksBefore = (counts: readonly number[]) => counts.map((n) => addDays(WEEK, -7 * n));

type CycleCase = 'aucun' | 'milieu' | 'allegee' | 'reprise';
function logsFor(level: TrainingLevel, state: CycleCase): SessionLog[] {
  const block = DELOAD_EVERY_WEEKS[level];
  const weeks =
    state === 'aucun'
      ? []
      : state === 'milieu'
        ? weeksBefore([1, 2])
        : state === 'allegee'
          ? weeksBefore(Array.from({ length: block - 1 }, (_, i) => i + 1))
          : weeksBefore([3]);
  return weeks.map((w) => logOf(w));
}

// ------------------------------------------------------------------ Matrice

interface Health {
  readonly name: string;
  readonly profile: Partial<Profile>;
  readonly training: Partial<TrainingProfile>;
}
const HEALTH: readonly Health[] = [
  { name: 'adulte', profile: {}, training: {} },
  { name: 'mineur 12', profile: { age: 12 }, training: {} },
  { name: 'mineur 17', profile: { age: 17 }, training: {} },
  { name: '18 ans', profile: { age: 18 }, training: {} },
  { name: '69 ans', profile: { age: 69 }, training: {} },
  { name: '70 ans', profile: { age: 70 }, training: {} },
  { name: '82 ans', profile: { age: 82 }, training: {} },
  { name: 'condition de santé', profile: { healthCondition: true }, training: {} },
  {
    name: 'grossesse T1',
    profile: { pregnantOrBreastfeeding: true },
    training: { pregnancyStage: 'premier-trimestre' },
  },
  {
    name: 'grossesse T2/T3',
    profile: { pregnantOrBreastfeeding: true },
    training: { pregnancyStage: 'apres-premier-trimestre' },
  },
  { name: 'grossesse, étape inconnue', profile: { pregnantOrBreastfeeding: true }, training: {} },
  {
    name: 'post-partum',
    profile: { pregnantOrBreastfeeding: true },
    training: { pregnancyStage: 'post-partum' },
  },
  {
    name: 'homme (grossesse ignorée)',
    profile: { sex: 'homme', pregnantOrBreastfeeding: true },
    training: {},
  },
  {
    name: 'mineure enceinte T1',
    profile: { age: 16, pregnantOrBreastfeeding: true },
    training: { pregnancyStage: 'premier-trimestre' },
  },
  { name: '75 ans avec condition', profile: { age: 75, healthCondition: true }, training: {} },
  {
    name: 'condition et post-partum',
    profile: { healthCondition: true, pregnantOrBreastfeeding: true },
    training: { pregnancyStage: 'post-partum' },
  },
];

interface Gear {
  readonly name: string;
  readonly setting: EquipmentSetting;
  readonly equipment: readonly Equipment[];
}
const GEARS: readonly Gear[] = [
  { name: 'maison', setting: 'maison', equipment: EQUIPMENT_BY_SETTING.maison },
  {
    name: 'maison équipée',
    setting: 'maison-equipee',
    equipment: EQUIPMENT_BY_SETTING['maison-equipee'],
  },
  { name: 'salle', setting: 'salle', equipment: EQUIPMENT_BY_SETTING.salle },
  {
    name: 'salle sans machines',
    setting: 'salle',
    equipment: EQUIPMENT_BY_SETTING.salle.filter((e) => e !== 'machine'),
  },
  { name: 'élastique seul', setting: 'maison', equipment: ['tapis', 'elastique'] },
];
const DURATIONS: readonly SessionDuration[] = [20, 30, 45, 60];
const GOALS: readonly TrainingGoal[] = ['forme', 'force', 'muscle', 'endurance'];
const CYCLES: readonly CycleCase[] = ['aucun', 'milieu', 'allegee', 'reprise'];

/** Les 126 ensembles de 1 à 6 jours parmi 7. */
const ALL_DAY_SETS: DayIndex[][] = Array.from({ length: 127 }, (_, mask) => mask + 1)
  .map((mask) => ([0, 1, 2, 3, 4, 5, 6] as const).filter((d) => (mask >> d) & 1))
  .filter((days) => days.length <= 6);

export interface PlanCase {
  readonly label: string;
  readonly input: PlanTrainingWeekInput;
}
function makeCase(
  catalog: readonly Exercise[],
  days: readonly DayIndex[],
  level: TrainingLevel,
  gear: Gear,
  minutes: SessionDuration,
  goal: TrainingGoal,
  health: Health,
  cycle: CycleCase,
): PlanCase {
  const training = makeTraining({
    frequency: days.length as 1,
    days,
    level,
    setting: gear.setting,
    equipment: gear.equipment,
    sessionMinutes: minutes,
    goal,
    ...health.training,
  });
  return {
    label: `${days.join('')}|${level}|${gear.name}|${minutes}|${goal}|${health.name}|${cycle}`,
    input: makePlanInput(training, health.profile, { catalog, logs: logsFor(level, cycle) }),
  };
}

/** Les combinaisons du balayage, pour un catalogue donné (fixtures ou catalogue réel). */
export function buildPlanCases(catalog: readonly Exercise[]): {
  readonly sweepDays: PlanCase[];
  readonly sweepHealth: PlanCase[];
  readonly all: PlanCase[];
} {
  /** Balayage 1 : tous les jours × tous les niveaux, les autres dimensions en rotation. */
  const sweepDays: PlanCase[] = ALL_DAY_SETS.flatMap((days, i) =>
    TRAINING_LEVELS.map((level, l) => {
      const k = i * 3 + l;
      return makeCase(
        catalog,
        days,
        level,
        GEARS[(k * 7) % GEARS.length] as Gear,
        DURATIONS[(k * 5) % DURATIONS.length] as SessionDuration,
        GOALS[(k * 3) % GOALS.length] as TrainingGoal,
        HEALTH[(k * 11) % HEALTH.length] as Health,
        CYCLES[(k * 13) % CYCLES.length] as CycleCase,
      );
    }),
  );

  /** Balayage 2 : profils santé × matériel × niveaux × durées, sur trois jeux de jours. */
  const sweepHealth: PlanCase[] = [
    [0, 2, 4],
    [0, 1, 2, 3, 4, 5],
    [5, 6],
  ].flatMap((days, d) =>
    HEALTH.flatMap((health, h) =>
      GEARS.flatMap((gear, g) =>
        TRAINING_LEVELS.flatMap((level, l) =>
          DURATIONS.map((minutes, m) =>
            makeCase(
              catalog,
              days as DayIndex[],
              level,
              gear,
              minutes,
              GOALS[(d + h + g + l + m) % GOALS.length] as TrainingGoal,
              health,
              CYCLES[(d + h + g + l + m) % CYCLES.length] as CycleCase,
            ),
          ),
        ),
      ),
    ),
  );

  return { sweepDays, sweepHealth, all: [...sweepDays, ...sweepHealth] };
}

// --------------------------------------------------------------- Vérifications

export const strength = (plan: WeeklyTrainingPlan) =>
  plan.sessions.filter((s) => s.kind !== 'douce');

function sessionHeavy(
  session: WeeklyTrainingPlan['sessions'][number],
  exerciseOf: (id: string) => Exercise,
): Set<MuscleGroup> {
  const groups = new Set<MuscleGroup>();
  for (const item of session.main) {
    if (RECOVERY_EXEMPT_PATTERNS.includes(item.pattern)) continue;
    exerciseOf(item.exerciseId).primaryMuscles.forEach((g) => groups.add(g));
  }
  return groups;
}

export function planViolations(
  { input }: PlanCase,
  plan: WeeklyTrainingPlan,
  catalog: readonly Exercise[],
): string[] {
  const BY_ID = new Map(catalog.map((e) => [e.id, e]));
  const exerciseOf = (id: string): Exercise => BY_ID.get(id) as Exercise;
  const out: string[] = [];
  const { training, profile } = input;
  const safety = assessTrainingSafety(profile, training);
  const excluded = oracleExcluded(profile, training);
  const available = new Set<Equipment>([...training.equipment, 'tapis']);
  const level = TRAINING_LEVELS.indexOf(training.level);

  // Séances : une par jour choisi, dates, identifiants.
  if (plan.sessions.map((s) => s.dayIndex).join() !== [...training.days].sort().join())
    out.push('jours');
  for (const s of plan.sessions) {
    if (s.date !== addDays(plan.weekStart, s.dayIndex)) out.push(`date ${s.id}`);
    const slots = [...s.warmup, ...s.main, ...s.cooldown].map((m) => m.slotId);
    if (new Set(slots).size !== slots.length) out.push(`slotId en double ${s.id}`);
    if (estimateSessionMinutes(s) !== s.estimatedMinutes) out.push(`durée recalculée ${s.id}`);
  }
  if (strength(plan).length > safety.maxStrengthSessions) out.push('plafond de séances');

  // Garde-fous : aucun exercice contre-indiqué, matériel, niveau.
  for (const s of plan.sessions) {
    for (const item of [...s.warmup, ...s.main, ...s.cooldown]) {
      const e = BY_ID.get(item.exerciseId);
      if (!e) {
        out.push(`exercice inconnu ${item.exerciseId}`);
        continue;
      }
      const bad = e.tags.filter((t) => excluded.has(t));
      if (bad.length > 0) out.push(`${e.id} contre-indiqué (${bad.join()})`);
      if (!e.equipment.every((q) => available.has(q))) out.push(`${e.id} matériel`);
      if (TRAINING_LEVELS.indexOf(e.level) > level) out.push(`${e.id} niveau`);
    }
    for (const item of s.main) {
      const t = item.prescription.target;
      if (t.measure === 'repetitions' && t.minReps < safety.minReps)
        out.push(`${item.exerciseId} répétitions < plancher`);
      if (!safety.loadProgression && item.prescription.loadKg !== undefined)
        out.push('charge sans progression');
      if (safety.intensity === 'moderee' && item.prescription.repsInReserve < 3)
        out.push('réserve < 3');
    }
    if (training.level === 'debutant' && s.main.some((m) => m.prescription.repsInReserve < 3))
      out.push('débutant réserve');
  }

  // 48 h : jamais un même groupe fortement sollicité à moins de 2 jours d'écart.
  const heavy = strength(plan);
  heavy.forEach((a, i) => {
    for (const b of heavy.slice(i + 1)) {
      if (cyclicDayGap(a.dayIndex, b.dayIndex) >= MIN_RECOVERY_DAYS) continue;
      const shared = [...sessionHeavy(a, exerciseOf)].filter((g) =>
        sessionHeavy(b, exerciseOf).has(g),
      );
      if (shared.length > 0) out.push(`48 h ${a.id}/${b.id} : ${shared.join()}`);
    }
    if (sessionHeavy(a, exerciseOf).size !== new Set(a.heavyGroups).size) out.push('heavyGroups');
  });

  // Équilibres hebdomadaires.
  const sets = weeklySetsByPattern(plan);
  const sum = (patterns: readonly (keyof typeof sets)[]) =>
    patterns.reduce((t, p) => t + sets[p], 0);
  const push = sum(PUSH_PATTERNS);
  const pull = sum(PULL_PATTERNS);
  if (push + pull > 0) {
    const ratio = pull / push;
    if (!(ratio >= BALANCE_RULES.pullToPushMin && ratio <= BALANCE_RULES.pullToPushMax))
      out.push(`tirage/poussée ${pull}/${push}`);
  }
  if (sets.genou + sets.hanche > 0) {
    const ratio = sets.genou / sets.hanche;
    if (!(ratio >= BALANCE_RULES.kneeToHipMin && ratio <= BALANCE_RULES.kneeToHipMax))
      out.push(`genou/hanche ${sets.genou}/${sets.hanche}`);
  }

  // Volume par groupe.
  const volume = weeklyVolumeByGroup(plan, catalog);
  for (const [group, value] of Object.entries(volume)) {
    if (value > WEEKLY_VOLUME[training.level].max) out.push(`volume ${group} ${value}`);
  }

  // Durée : dans la cible + 10 %, sans exception (une séance de 20 min = un seul bloc).
  // Seule tolérance, documentée dans l'ADR 0015 : pour les 70 ans et plus, le bloc équilibre
  // (obligatoire) s'ajoute au plancher du gabarit ; une séance à ce plancher peut dépasser, de
  // `SENIOR_FLOOR_OVERRUN` fois la cible au plus.
  const limit = training.sessionMinutes * (1 + TIMING.overrunRatio);
  for (const s of plan.sessions) {
    if (s.estimatedMinutes <= limit) continue;
    const blocks = new Set(s.main.map((m) => m.slotId.slice(0, m.slotId.indexOf('-'))));
    const floor =
      (training.sessionMinutes === SHORT_SESSION_MINUTES
        ? 1
        : SESSION_TEMPLATES[s.kind].minBlocks) + 1;
    const seniorFloor = safety.includeBalance && s.kind !== 'douce' && blocks.size <= floor;
    const allowed = seniorFloor ? training.sessionMinutes * SENIOR_FLOOR_OVERRUN : limit;
    if (s.estimatedMinutes > allowed) {
      out.push(`durée ${s.estimatedMinutes} > ${allowed} (${s.id}, ${s.kind})`);
    }
  }

  // 70 ans et plus : un exercice d'équilibre dans chaque séance de renforcement.
  if (safety.includeBalance) {
    for (const s of strength(plan)) {
      if (!s.main.some((m) => m.pattern === 'equilibre')) out.push(`équilibre absent ${s.id}`);
    }
  }
  return out;
}

/**
 * Cible minimale de volume des grands groupes dès trois séances de 45 min ou plus (semaine non
 * allégée) : la cible entière pour un débutant, 40 % pour les autres niveaux.
 */
export function volumeTargetFailures(
  cases: readonly PlanCase[],
  catalog: readonly Exercise[],
): { readonly checked: number; readonly failures: string[] } {
  const failures: string[] = [];
  const main: MuscleGroup[] = ['pectoraux', 'dos', 'quadriceps', 'fessiers'];
  let checked = 0;
  for (const c of cases) {
    const { training } = c.input;
    if (training.days.length !== 3 || training.sessionMinutes < 45) continue;
    const plan = planTrainingWeek(c.input);
    if (plan.cycle.deload || strength(plan).length < 3) continue;
    checked += 1;
    const volume = weeklyVolumeByGroup(plan, catalog);
    const min = WEEKLY_VOLUME[training.level].min;
    const required = training.level === 'debutant' ? min : min * 0.4;
    for (const g of main) {
      if (volume[g] < required) failures.push(`${c.label} ${g} ${volume[g]} < ${required}`);
    }
  }
  return { checked, failures };
}
