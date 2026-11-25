import { z } from '../data/zod';
import { migrateQuizStateToSessions } from '../migrations/quizSessions';
import type { BackupParseResult, EncryptedPayload } from '@application/ports';
import { MEAL_SLOTS } from '@domain/mealplan';
import type {
  PlanNoticeCode,
  PlannedMeal,
  RelaxedConstraint,
  ScoreBreakdown,
  ScoreComponentKey,
} from '@domain/mealplan';
import {
  BODY_ACCESSORY_IDS,
  COLOR_IDS,
  EYE_IDS,
  FACE_ACCESSORY_IDS,
  HEAD_ACCESSORY_IDS,
  INITIAL_COMPANION_STATE,
  NECK_ACCESSORY_IDS,
  equip,
} from '@domain/companion';
import type { CompanionState } from '@domain/companion';
import { RATING_REASONS } from '@domain/preferences';
import { ACTIVITY_LEVELS, GOALS, SEXES } from '@domain/profile';
import type { Profile } from '@domain/profile';
import type { ProgressEntry } from '@domain/progress';
import type { QuizState } from '@domain/quiz';
import { AISLES, ALLERGENS, DIETS, LEVELS } from '@domain/recipe';
import { addDays, dayOfWeek, isIsoDate } from '@domain/shared';
import {
  EFFORT_FEELINGS,
  EQUIPMENT,
  EQUIPMENT_SETTINGS,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  PREGNANCY_STAGES,
  SESSION_DURATIONS,
  SESSION_KINDS,
  SLOT_ROLES,
  TRAINING_FREQUENCIES,
  TRAINING_GOALS,
  TRAINING_LEVELS,
} from '@domain/training';
import type {
  CycleInfo,
  ExerciseLog,
  PainReport,
  PlannedExercise,
  PlannedSession,
  Prescription,
  ProgressionAdvice,
  SavedTrainingPlan,
  SessionLog,
  SessionStatus,
  SetLog,
  SplitName,
  TrainingNoticeCode,
  TrainingProfile,
} from '@domain/training';
import { SNAPSHOT_SCHEMA_VERSION, THEMES } from '@domain/userdata';
import type {
  BackupFile,
  RatingRecord,
  SavedPlan,
  ShoppingRecord,
  UserDataSnapshot,
  UserSettings,
} from '@domain/userdata';

/**
 * Validation stricte d'une sauvegarde importée : c'est une donnée NON FIABLE (fichier
 * modifié à la main, d'une autre app, piégé). Bornes de taille partout, vocabulaires
 * fermés dérivés du domain, puis migration des anciens formats (`SNAPSHOT_MIGRATIONS`).
 * Les clés inconnues sont ignorées (jamais recopiées).
 */

// ---------------------------------------------------------------------------- Bornes

export const BACKUP_LIMITS = {
  shortText: 120,
  longText: 2_000,
  key: 10_000,
  list: 500,
  plans: 1_000,
  ratings: 20_000,
  progress: 5_000,
  quizSeen: 10_000,
  streak: 100_000,
  meals: 21,
  /** Programmes hebdomadaires (près de 29 ans), journaux de séance et signalements (ADR 0015). */
  trainingPlans: 1_500,
  sessionLogs: 3_000,
  painReports: 500,
  sessionsPerWeek: 7,
  exercisesPerSession: 60,
  setsPerExercise: 20,
  reps: 200,
  seconds: 3_600,
  loadKg: 500,
  notices: 10,
} as const;

const text = (max: number = BACKUP_LIMITS.shortText) => z.string().max(max);
const list = <T extends z.ZodType>(item: T, max: number = BACKUP_LIMITS.list) =>
  z.array(item).max(max);
// Zod 4 : `z.number()` refuse déjà Infinity et NaN.
const num = z.number();
const isoDate = z.string().max(10).refine(isIsoDate, 'date AAAA-MM-JJ attendue');
/**
 * Instant ISO en UTC (`Z`) uniquement, comme `toISOString` : comparable comme une chaîne.
 * `Date.parse` accepte le 30 février (reporté au 2 mars) : on vérifie aussi le jour.
 */
const isoDateTime = z
  .string()
  .max(40)
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/, 'instant ISO en UTC (Z) attendu')
  .refine(
    (s) => isIsoDate(s.slice(0, 10)) && !Number.isNaN(Date.parse(s)),
    'date et heure ISO attendues',
  );

function unique<T>(key: (item: T) => string, label: string) {
  return (items: readonly T[], ctx: z.RefinementCtx) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const k = key(item);
      if (seen.has(k)) {
        ctx.addIssue({ code: 'custom', path: [index], message: `${label} en double` });
      }
      seen.add(k);
    });
  };
}

// ---------------------------------------------------------------------------- Profil

const profileSchema = z.object({
  age: num,
  sex: z.enum(SEXES),
  heightCm: num,
  weightKg: num,
  waistCm: num.optional(),
  activity: z.enum(ACTIVITY_LEVELS),
  goal: z.enum(GOALS),
  diets: list(z.enum(DIETS), DIETS.length),
  allergens: list(z.enum(ALLERGENS), ALLERGENS.length),
  likes: list(text()),
  dislikes: list(text()),
  householdSize: z.number().int(),
  weekdayMinutes: num,
  weekendMinutes: num,
  weekdayLevel: z.enum(LEVELS),
  weekendLevel: z.enum(LEVELS),
  breakfast: z.boolean(),
  batchCooking: z.boolean(),
  pregnantOrBreastfeeding: z.boolean(),
  healthCondition: z.boolean().optional(),
});

// ---------------------------------------------------------------------------- Menus

const SCORE_KEYS = [
  'aime',
  'notes',
  'saison',
  'temps',
  'niveau',
  'variete',
  'hasard',
] as const satisfies readonly ScoreComponentKey[];
const RELAXED = [
  'niveau',
  'evitee',
  'variete-proteine',
  'doublon',
  'temps',
] as const satisfies readonly RelaxedConstraint[];
const NOTICE_CODES = [
  'aucune-recette-compatible',
  'petit-dejeuner-indisponible',
  'contraintes-assouplies',
] as const satisfies readonly PlanNoticeCode[];

const scoreSchema = z.object({
  total: num,
  components: list(z.object({ key: z.enum(SCORE_KEYS), points: num }), SCORE_KEYS.length),
  facts: z.object({
    likedTerms: list(text()),
    seasonMatch: z.boolean(),
    seasonalProduce: list(text()),
    totalMinutes: num,
    fitsTime: z.boolean(),
    ratedPositively: z.boolean(),
    batchFriendly: z.boolean(),
    newProtein: z.boolean(),
  }),
});

const plannedMealSchema = z.object({
  id: text(),
  dayIndex: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
  date: isoDate,
  slot: z.enum(MEAL_SLOTS),
  recipeId: text(),
  isLeftover: z.boolean(),
  leftoverOf: text().optional(),
  requestedLevel: z.enum(LEVELS).optional(),
  relaxed: list(z.enum(RELAXED), RELAXED.length),
  score: scoreSchema,
});

const savedPlanSchema = z.object({
  weekStart: isoDate,
  meals: list(plannedMealSchema, BACKUP_LIMITS.meals),
  notices: list(
    z.object({ code: z.enum(NOTICE_CODES), message: text(BACKUP_LIMITS.longText) }),
    NOTICE_CODES.length,
  ),
  constraintsKey: text(BACKUP_LIMITS.key),
  generatedAt: isoDateTime,
});

// ---------------------------------------------------------------------------- Le reste

const ratingSchema = z.object({
  id: text(),
  recipeId: text(),
  verdict: z.enum(['up', 'down']),
  reason: z.enum(RATING_REASONS).optional(),
  ratedAt: isoDateTime,
  weekStart: isoDate.optional(),
  mealId: text().optional(),
});

const positive = num.positive();
const progressSchema = z.object({
  date: isoDate,
  weightKg: positive.optional(),
  waistCm: positive.optional(),
});

const count = z.number().int().nonnegative();
const quizSchema = z.object({
  seenIds: list(text(), BACKUP_LIMITS.quizSeen),
  streak: count,
  bestStreak: count,
  current: z
    .object({
      sessionId: text(),
      questionId: text(),
      answerIndex: z.number().int().min(0).max(3).optional(),
    })
    .optional(),
});

const dayCount = z.number().int().nonnegative().max(BACKUP_LIMITS.streak);
const companionSchema = z.object({
  look: z.object({
    color: z.enum(COLOR_IDS),
    eyes: z.enum(EYE_IDS),
    accessories: z.object({
      tete: z.enum(HEAD_ACCESSORY_IDS).optional(),
      visage: z.enum(FACE_ACCESSORY_IDS).optional(),
      cou: z.enum(NECK_ACCESSORY_IDS).optional(),
      corps: z.enum(BODY_ACCESSORY_IDS).optional(),
    }),
  }),
  lastActiveDay: isoDate.optional(),
  streak: dayCount,
  best: dayCount,
  acknowledgedBest: dayCount,
});

const shoppingSchema = z.object({
  weekStart: isoDate,
  basisKey: text(BACKUP_LIMITS.key),
  state: z.object({
    checkedKeys: list(text(BACKUP_LIMITS.longText), BACKUP_LIMITS.list * 2),
    manualItems: list(
      z.object({ id: text(), label: text(), aisle: z.enum(AISLES).optional() }),
      BACKUP_LIMITS.list,
    ),
  }),
});

const settingsSchema = z.object({
  theme: z.enum(THEMES),
  weightTracking: z.boolean().optional(),
  profileCreatedAt: isoDateTime.optional(),
  lastBackupAt: isoDateTime.optional(),
  lastBackupReminderOn: isoDate.optional(),
  persistenceGranted: z.boolean().optional(),
  activitySuggestionDismissedOn: isoDate.optional(),
});

// ---------------------------------------------------------------------------- Sport

const dayIndex = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);
/** Identifiant d'exercice du catalogue : kebab-case ASCII. */
const exerciseId = z
  .string()
  .max(BACKUP_LIMITS.shortText)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'identifiant d’exercice attendu');
const mondayDate = isoDate;

const FREQUENCIES = z.union(
  TRAINING_FREQUENCIES.map((n) => z.literal(n)) as unknown as [
    z.ZodLiteral<1>,
    z.ZodLiteral<2>,
    ...z.ZodLiteral<3 | 4 | 5 | 6>[],
  ],
);
const DURATIONS = z.union(
  SESSION_DURATIONS.map((n) => z.literal(n)) as unknown as [
    z.ZodLiteral<20>,
    z.ZodLiteral<30>,
    ...z.ZodLiteral<45 | 60>[],
  ],
);

const trainingProfileSchema = z.object({
  frequency: FREQUENCIES,
  days: list(dayIndex, 6),
  setting: z.enum(EQUIPMENT_SETTINGS),
  equipment: list(z.enum(EQUIPMENT), EQUIPMENT.length),
  level: z.enum(TRAINING_LEVELS),
  goal: z.enum(TRAINING_GOALS),
  sessionMinutes: DURATIONS,
  pregnancyStage: z.enum(PREGNANCY_STAGES).optional(),
  startedOn: mondayDate,
  safetyAcknowledgedOn: isoDate.optional(),
});

const SPLIT_NAMES = [
  'full-body',
  'haut-bas',
  'ppl',
  'ppl-haut-bas',
  'haut-bas-full',
] as const satisfies readonly SplitName[];
const NOTICE_CODES_TRAINING = [
  'jours-rapproches',
  'seances-plafonnees',
  'catalogue-insuffisant',
  'semaine-allegee',
  'reprise',
] as const satisfies readonly TrainingNoticeCode[];
const ADVICE = [
  'trouve-ta-charge',
  'ajoute-une-repetition',
  'augmente-la-charge',
  'maintiens',
  'allege',
  'variante-plus-dure',
  'semaine-allegee',
] as const satisfies readonly ProgressionAdvice[];
const STATUSES = ['en-cours', 'terminee'] as const satisfies readonly SessionStatus[];

const reps = z.number().int().min(0).max(BACKUP_LIMITS.reps);
const seconds = z.number().int().min(0).max(BACKUP_LIMITS.seconds);
const loadKg = z.number().min(0).max(BACKUP_LIMITS.loadKg);
const setCount = z.number().int().min(1).max(BACKUP_LIMITS.setsPerExercise);

const prescriptionSchema = z.object({
  sets: setCount,
  target: z.union([
    z.object({ measure: z.literal('repetitions'), minReps: reps, maxReps: reps }),
    z.object({ measure: z.literal('duree'), minSeconds: seconds, maxSeconds: seconds }),
  ]),
  restSeconds: seconds,
  loadKg: loadKg.optional(),
  advice: z.enum(ADVICE),
  repsInReserve: z.number().int().min(0).max(10),
});

const plannedExerciseSchema = z.object({
  slotId: text(),
  exerciseId,
  pattern: z.enum(MOVEMENT_PATTERNS),
  role: z.enum(SLOT_ROLES),
  unilateral: z.boolean(),
  prescription: prescriptionSchema,
});

const plannedExercises = list(plannedExerciseSchema, BACKUP_LIMITS.exercisesPerSession);

const plannedSessionSchema = z.object({
  id: text(),
  dayIndex,
  date: isoDate,
  kind: z.enum(SESSION_KINDS),
  title: text(),
  warmup: plannedExercises,
  main: plannedExercises,
  cooldown: plannedExercises,
  estimatedMinutes: z.number().min(0).max(1_000),
  heavyGroups: list(z.enum(MUSCLE_GROUPS), MUSCLE_GROUPS.length),
});

const cycleSchema = z.object({
  activeWeeks: count,
  blockIndex: count,
  weekInBlock: z.number().int().min(1).max(100),
  blockLength: z.number().int().min(1).max(100),
  deload: z.boolean(),
  deloadReason: z.enum(['cycle', 'reprise']).optional(),
});

const trainingPlanSchema = z.object({
  weekStart: mondayDate,
  split: z.enum(SPLIT_NAMES),
  cycle: cycleSchema,
  sessions: list(plannedSessionSchema, BACKUP_LIMITS.sessionsPerWeek),
  notices: list(
    z.object({ code: z.enum(NOTICE_CODES_TRAINING), message: text(BACKUP_LIMITS.longText) }),
    BACKUP_LIMITS.notices,
  ),
  constraintsKey: text(BACKUP_LIMITS.key),
  generatedAt: isoDateTime,
});

const setLogSchema = z.object({
  index: z
    .number()
    .int()
    .min(0)
    .max(BACKUP_LIMITS.setsPerExercise - 1),
  done: z.boolean(),
  reps: reps.optional(),
  seconds: seconds.optional(),
  loadKg: loadKg.optional(),
});

const exerciseLogSchema = z.object({
  slotId: text(),
  exerciseId,
  replacedExerciseId: exerciseId.optional(),
  sets: list(setLogSchema, BACKUP_LIMITS.setsPerExercise),
  done: z.boolean(),
  effort: z.enum(EFFORT_FEELINGS).optional(),
});

const sessionLogSchema = z.object({
  id: text(),
  weekStart: mondayDate,
  sessionId: text(),
  date: isoDate,
  status: z.enum(STATUSES),
  startedAt: isoDateTime,
  completedAt: isoDateTime.optional(),
  exercises: list(exerciseLogSchema, BACKUP_LIMITS.exercisesPerSession),
  effort: z.enum(EFFORT_FEELINGS).optional(),
});

const painReportSchema = z.object({
  id: text(),
  date: isoDate,
  exerciseId,
  muscles: list(z.enum(MUSCLE_GROUPS), MUSCLE_GROUPS.length),
});

export const backupFileSchema = z.object({
  app: z.literal('nutry'),
  schemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
  exportedAt: isoDateTime,
  profile: profileSchema.optional(),
  plans: list(savedPlanSchema, BACKUP_LIMITS.plans).superRefine(
    unique((p) => p.weekStart, 'semaine'),
  ),
  ratings: list(ratingSchema, BACKUP_LIMITS.ratings).superRefine(unique((r) => r.id, 'avis')),
  progress: list(progressSchema, BACKUP_LIMITS.progress).superRefine(
    unique((p) => p.date, 'mesure'),
  ),
  quiz: quizSchema,
  companion: companionSchema,
  shopping: list(shoppingSchema, BACKUP_LIMITS.plans).superRefine(
    unique((s) => s.weekStart, 'semaine'),
  ),
  settings: settingsSchema,
  training: trainingProfileSchema.optional(),
  trainingPlans: list(trainingPlanSchema, BACKUP_LIMITS.trainingPlans).superRefine(
    unique((p) => p.weekStart, 'semaine'),
  ),
  sessionLogs: list(sessionLogSchema, BACKUP_LIMITS.sessionLogs).superRefine(
    unique((l) => l.id, 'journal'),
  ),
  painReports: list(painReportSchema, BACKUP_LIMITS.painReports).superRefine(
    unique((r) => r.id, 'signalement'),
  ),
});

/** Marge tolérée après `exportedAt` (horloges et fuseaux décalés). */
const FUTURE_MARGIN_MS = 24 * 60 * 60 * 1000;

type ParsedBackup = z.infer<typeof backupFileSchema>;

/**
 * Cohérence du compagnon : la série ne dépasse pas le record, un jour actif accompagne
 * toute série, et l'apparence ne porte que des éléments débloqués par le record.
 */
function checkCompanion(companion: ParsedBackup['companion'], ctx: z.RefinementCtx): void {
  const issue = (path: string, message: string) => {
    ctx.addIssue({ code: 'custom', path: ['companion', path], message });
  };
  if (companion.streak > companion.best) issue('streak', 'série supérieure au record');
  if (companion.acknowledgedBest > companion.best) {
    issue('acknowledgedBest', 'record célébré supérieur au record');
  }
  if ((companion.lastActiveDay === undefined) !== (companion.best === 0)) {
    issue('lastActiveDay', 'jour actif incohérent avec le record');
  }
  if (!equip(companion as CompanionState, companion.look as CompanionState['look']).ok) {
    issue('look', 'apparence non débloquée');
  }
}

/** Cohérence du Sport (ADR 0015) : lundis, identifiants, jours triés, dates et statuts. */
function checkTraining(
  backup: ParsedBackup,
  ctx: z.RefinementCtx,
  limits: {
    readonly day: (value: string | undefined, path: (string | number)[]) => void;
    readonly instant: (value: string | undefined, path: (string | number)[]) => void;
  },
): void {
  const issue = (path: (string | number)[], message: string) => {
    ctx.addIssue({ code: 'custom', path, message });
  };
  const monday = (value: string, path: (string | number)[]) => {
    if (isIsoDate(value) && dayOfWeek(value) !== 0) issue(path, 'un lundi est attendu');
  };
  const { training } = backup;
  if (training) {
    const { days } = training;
    if (days.length !== training.frequency) {
      issue(['training', 'days'], 'autant de jours que de séances par semaine');
    }
    if (days.some((d, i) => i > 0 && d <= (days[i - 1] ?? -1))) {
      issue(['training', 'days'], 'jours triés et sans doublon attendus');
    }
    monday(training.startedOn, ['training', 'startedOn']);
    limits.day(training.startedOn, ['training', 'startedOn']);
    limits.day(training.safetyAcknowledgedOn, ['training', 'safetyAcknowledgedOn']);
  }
  backup.trainingPlans.forEach((plan, p) => {
    monday(plan.weekStart, ['trainingPlans', p, 'weekStart']);
    limits.day(plan.weekStart, ['trainingPlans', p, 'weekStart']);
    limits.instant(plan.generatedAt, ['trainingPlans', p, 'generatedAt']);
    const ids = new Set<string>();
    plan.sessions.forEach((session, i) => {
      if (ids.has(session.id)) issue(['trainingPlans', p, 'sessions', i, 'id'], 'séance en double');
      ids.add(session.id);
      if (isIsoDate(plan.weekStart) && session.date !== addDays(plan.weekStart, session.dayIndex)) {
        issue(
          ['trainingPlans', p, 'sessions', i, 'date'],
          'date incohérente avec le jour de la séance',
        );
      }
    });
  });
  backup.sessionLogs.forEach((log, l) => {
    const at = (field: string) => ['sessionLogs', l, field];
    if (log.id !== `${log.weekStart}:${log.sessionId}`) issue(at('id'), 'identifiant incohérent');
    monday(log.weekStart, at('weekStart'));
    if (log.date < log.weekStart) issue(at('date'), 'date antérieure à la semaine de la séance');
    limits.day(log.date, at('date'));
    limits.instant(log.startedAt, at('startedAt'));
    limits.instant(log.completedAt, at('completedAt'));
    if ((log.status === 'terminee') !== (log.completedAt !== undefined)) {
      issue(at('completedAt'), 'fin incohérente avec le statut');
    }
    if (log.completedAt !== undefined && log.completedAt < log.startedAt) {
      issue(at('completedAt'), 'fin antérieure au début');
    }
    const slots = new Set<string>();
    log.exercises.forEach((exercise, e) => {
      if (slots.has(exercise.slotId)) {
        issue(['sessionLogs', l, 'exercises', e, 'slotId'], 'créneau en double');
      }
      slots.add(exercise.slotId);
      const indexes = new Set<number>();
      exercise.sets.forEach((set, k) => {
        if (indexes.has(set.index)) {
          issue(['sessionLogs', l, 'exercises', e, 'sets', k, 'index'], 'série en double');
        }
        indexes.add(set.index);
      });
    });
  });
  backup.painReports.forEach((report, r) => {
    if (report.id !== `${report.date}:${report.exerciseId}`) {
      issue(['painReports', r, 'id'], 'identifiant incohérent');
    }
    limits.day(report.date, ['painReports', r, 'date']);
  });
}

/**
 * Cohérence d'ensemble : rien n'est daté après l'export (+ 1 jour), les repas d'un menu
 * ont des identifiants uniques et une date conforme à leur jour de la semaine (le
 * `weekStart` d'un menu est le lundi de sa semaine).
 */
function checkCoherence(backup: ParsedBackup, ctx: z.RefinementCtx): void {
  // Peut s'exécuter sur des données déjà signalées invalides : ne jamais lever.
  const limitMs = Date.parse(backup.exportedAt) + FUTURE_MARGIN_MS;
  if (!Number.isFinite(limitMs)) return;
  const limitDay = new Date(limitMs).toISOString().slice(0, 10);
  const future = (path: (string | number)[]) => {
    ctx.addIssue({ code: 'custom', path, message: 'date postérieure à l’export' });
  };
  const instant = (value: string | undefined, path: (string | number)[]) => {
    if (value !== undefined && Date.parse(value) > limitMs) future(path);
  };
  const day = (value: string | undefined, path: (string | number)[]) => {
    if (value !== undefined && value > limitDay) future(path);
  };

  backup.plans.forEach((plan, p) => {
    day(plan.weekStart, ['plans', p, 'weekStart']);
    instant(plan.generatedAt, ['plans', p, 'generatedAt']);
    const ids = new Set<string>();
    plan.meals.forEach((meal, m) => {
      if (ids.has(meal.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['plans', p, 'meals', m, 'id'],
          message: 'repas en double',
        });
      }
      ids.add(meal.id);
      if (isIsoDate(plan.weekStart) && meal.date !== addDays(plan.weekStart, meal.dayIndex)) {
        ctx.addIssue({
          code: 'custom',
          path: ['plans', p, 'meals', m, 'date'],
          message: 'date incohérente avec le jour du menu',
        });
      }
    });
  });
  backup.ratings.forEach((r, i) => {
    instant(r.ratedAt, ['ratings', i, 'ratedAt']);
    day(r.weekStart, ['ratings', i, 'weekStart']);
  });
  backup.progress.forEach((e, i) => {
    day(e.date, ['progress', i, 'date']);
  });
  backup.shopping.forEach((s, i) => {
    day(s.weekStart, ['shopping', i, 'weekStart']);
  });
  checkTraining(backup, ctx, { day, instant });
  checkCompanion(backup.companion, ctx);
  day(backup.companion.lastActiveDay, ['companion', 'lastActiveDay']);
  const { settings } = backup;
  instant(settings.profileCreatedAt, ['settings', 'profileCreatedAt']);
  instant(settings.lastBackupAt, ['settings', 'lastBackupAt']);
  day(settings.lastBackupReminderOn, ['settings', 'lastBackupReminderOn']);
  day(settings.activitySuggestionDismissedOn, ['settings', 'activitySuggestionDismissedOn']);
}

const coherentBackupSchema = backupFileSchema.superRefine(checkCoherence);

export const encryptedPayloadSchema = z.object({
  v: z.literal(1),
  alg: z.literal('AES-GCM'),
  kdf: z.literal('PBKDF2-SHA256'),
  iter: z.number().int().positive(),
  salt: z.string().max(64),
  iv: z.string().max(64),
  // Le contenu chiffré est borné par la taille maximale d'un import.
  data: z.string(),
});

// --------------------------------------------- Alignement à la compilation sur le domain

/** Retire `readonly` et les `undefined` explicites (absents d'un JSON). */
type Plain<T> = T extends readonly (infer U)[]
  ? Plain<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: Plain<Exclude<T[K], undefined>> }
    : T;
type Assignable<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
/** Mutuellement assignables ET mêmes clés (un champ facultatif oublié est détecté). */
type Same<A, B> = Assignable<A, B> extends true ? Assignable<keyof A, keyof B> : false;
/**
 * Vérifications à la compilation : chaque schéma correspond exactement au type du domain
 * (vérifiées table par table, les comparaisons trop profondes n'étant pas fiables).
 * Une valeur ajoutée à un vocabulaire du domain sans le schéma fait échouer `tsc`.
 */
type Checks = [
  Same<Plain<z.infer<typeof profileSchema>>, Plain<Profile>>,
  Same<Plain<z.infer<typeof scoreSchema>>, Plain<ScoreBreakdown>>,
  Same<Plain<z.infer<typeof plannedMealSchema>>, Plain<PlannedMeal>>,
  Same<Plain<z.infer<typeof savedPlanSchema>>, Plain<SavedPlan>>,
  Same<Plain<z.infer<typeof ratingSchema>>, Plain<RatingRecord>>,
  Same<Plain<z.infer<typeof progressSchema>>, Plain<ProgressEntry>>,
  Same<Plain<z.infer<typeof quizSchema>>, Plain<QuizState>>,
  Same<Plain<z.infer<typeof companionSchema>>, Plain<CompanionState>>,
  Same<Plain<z.infer<typeof shoppingSchema>>, Plain<ShoppingRecord>>,
  Same<Plain<z.infer<typeof settingsSchema>>, Plain<UserSettings>>,
  Same<Plain<z.infer<typeof trainingProfileSchema>>, Plain<TrainingProfile>>,
  Same<Plain<z.infer<typeof cycleSchema>>, Plain<CycleInfo>>,
  Same<Plain<z.infer<typeof prescriptionSchema>>, Plain<Prescription>>,
  Same<Plain<z.infer<typeof plannedExerciseSchema>>, Plain<PlannedExercise>>,
  Same<Plain<z.infer<typeof plannedSessionSchema>>, Plain<PlannedSession>>,
  Same<Plain<z.infer<typeof trainingPlanSchema>>, Plain<SavedTrainingPlan>>,
  Same<Plain<z.infer<typeof setLogSchema>>, Plain<SetLog>>,
  Same<Plain<z.infer<typeof exerciseLogSchema>>, Plain<ExerciseLog>>,
  Same<Plain<z.infer<typeof sessionLogSchema>>, Plain<SessionLog>>,
  Same<Plain<z.infer<typeof painReportSchema>>, Plain<PainReport>>,
  Same<keyof z.infer<typeof backupFileSchema>, keyof BackupFile>,
  Same<Plain<z.infer<typeof encryptedPayloadSchema>>, Plain<EncryptedPayload>>,
];
type AssertAll<T extends readonly true[]> = T;
/** Type exporté uniquement pour forcer l'évaluation des vérifications ci-dessus. */
export type SchemasMatchDomain = AssertAll<Checks>;

// ---------------------------------------------------------------------------- Migrations

type RawBackup = Record<string, unknown>;
/** Migration d'un export de la version `n` vers `n + 1`. */
export type SnapshotMigration = (raw: RawBackup) => RawBackup;

/**
 * Migrations des formats d'export, indexées par version de DÉPART (n → n + 1). Pour un
 * nouveau format : incrémenter `SNAPSHOT_SCHEMA_VERSION`, adapter le schéma ci-dessus et
 * ajouter ici `n: (raw) => ({ ...raw, schemaVersion: n + 1, … })`. Chaque migration reçoit
 * un fichier NON FIABLE : elle ne lève jamais (le schéma valide le résultat).
 */
export const SNAPSHOT_MIGRATIONS: Readonly<Record<number, SnapshotMigration>> = {
  // v1 → v2 : quiz « question du jour » (`daily`) → question à chaque ouverture (`current`).
  1: (raw) => ({ ...raw, schemaVersion: 2, quiz: migrateQuizStateToSessions(raw['quiz']) }),
  // v2 → v3 : compagnon Nutry. Un export v2 n'en contient pas : état initial (ADR 0012).
  2: (raw) => ({ ...raw, schemaVersion: 3, companion: INITIAL_COMPANION_STATE }),
  // v3 → v4 : module Sport (ADR 0015). Un export v3 n'en contient pas : pas de profil sportif,
  // aucune liste. Les clés éventuelles du Sport dans un fichier v3 sont écrasées (jamais reprises).
  3: (raw) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { training, ...rest } = raw;
    return { ...rest, schemaVersion: 4, trainingPlans: [], sessionLogs: [], painReports: [] };
  },
};

const MAX_ERRORS = 5;

function formatIssues(issues: readonly z.core.$ZodIssue[]): string[] {
  return issues
    .slice(0, MAX_ERRORS)
    .map((i) => `${i.path.map(String).join('.') || '(racine)'}: ${i.message}`);
}

const isRecord = (raw: unknown): raw is RawBackup =>
  typeof raw === 'object' && raw !== null && !Array.isArray(raw);

/** Amène un export ancien au format courant ; `undefined` si impossible. */
export function migrateBackup(
  raw: RawBackup,
  migrations: Readonly<Record<number, SnapshotMigration>> = SNAPSHOT_MIGRATIONS,
  current: number = SNAPSHOT_SCHEMA_VERSION,
):
  | { ok: true; raw: RawBackup }
  | { ok: false; reason: 'invalide' | 'version-future'; error: string } {
  let version = raw['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, reason: 'invalide', error: 'schemaVersion: version absente ou invalide' };
  }
  if (version > current) {
    return {
      ok: false,
      reason: 'version-future',
      error: `schemaVersion: ${version} > ${current}`,
    };
  }
  let migrated = raw;
  while (version < current) {
    const migrate = migrations[version];
    if (!migrate) {
      return { ok: false, reason: 'invalide', error: `schemaVersion: ${version} non migrable` };
    }
    migrated = migrate(migrated);
    version += 1;
  }
  return { ok: true, raw: migrated };
}

/** Valide (et migre) une sauvegarde en clair. */
export function parseBackupFile(raw: unknown): BackupParseResult {
  if (!isRecord(raw) || raw['app'] !== 'nutry') {
    return { ok: false, reason: 'invalide', errors: ['app: fichier non issu de Nutry'] };
  }
  const migrated = migrateBackup(raw);
  if (!migrated.ok) return { ok: false, reason: migrated.reason, errors: [migrated.error] };
  const result = coherentBackupSchema.safeParse(migrated.raw);
  if (!result.success) {
    return { ok: false, reason: 'invalide', errors: formatIssues(result.error.issues) };
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { app, exportedAt, ...snapshot } = result.data;
  // Sûr : un JSON ne contient jamais de `undefined` explicite (seule différence de type).
  return { ok: true, snapshot: snapshot as UserDataSnapshot, exportedAt };
}

export function parseEncryptedPayload(raw: unknown): EncryptedPayload | undefined {
  const result = encryptedPayloadSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}
