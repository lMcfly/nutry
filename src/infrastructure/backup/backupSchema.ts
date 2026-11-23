import { z } from 'zod';
import type { BackupParseResult, EncryptedPayload } from '@application/ports';
import { MEAL_SLOTS } from '@domain/mealplan';
import type {
  PlanNoticeCode,
  PlannedMeal,
  RelaxedConstraint,
  ScoreBreakdown,
  ScoreComponentKey,
} from '@domain/mealplan';
import { RATING_REASONS } from '@domain/preferences';
import { ACTIVITY_LEVELS, GOALS, SEXES } from '@domain/profile';
import type { Profile } from '@domain/profile';
import type { ProgressEntry } from '@domain/progress';
import type { QuizState } from '@domain/quiz';
import { AISLES, ALLERGENS, DIETS, LEVELS } from '@domain/recipe';
import { addDays, isIsoDate } from '@domain/shared';
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
  meals: 21,
} as const;

const text = (max: number = BACKUP_LIMITS.shortText) => z.string().max(max);
const list = <T extends z.ZodTypeAny>(item: T, max: number = BACKUP_LIMITS.list) =>
  z.array(item).max(max);
const num = z.number().finite();
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
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [index], message: `${label} en double` });
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
  daily: z
    .object({
      date: isoDate,
      questionId: text(),
      answerIndex: z.number().int().min(0).max(3).optional(),
    })
    .optional(),
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
  shopping: list(shoppingSchema, BACKUP_LIMITS.plans).superRefine(
    unique((s) => s.weekStart, 'semaine'),
  ),
  settings: settingsSchema,
});

/** Marge tolérée après `exportedAt` (horloges et fuseaux décalés). */
const FUTURE_MARGIN_MS = 24 * 60 * 60 * 1000;

type ParsedBackup = z.infer<typeof backupFileSchema>;

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
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'date postérieure à l’export' });
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
          code: z.ZodIssueCode.custom,
          path: ['plans', p, 'meals', m, 'id'],
          message: 'repas en double',
        });
      }
      ids.add(meal.id);
      if (isIsoDate(plan.weekStart) && meal.date !== addDays(plan.weekStart, meal.dayIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
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
  day(backup.quiz.daily?.date, ['quiz', 'daily', 'date']);
  backup.shopping.forEach((s, i) => {
    day(s.weekStart, ['shopping', i, 'weekStart']);
  });
  const { settings } = backup;
  instant(settings.profileCreatedAt, ['settings', 'profileCreatedAt']);
  instant(settings.lastBackupAt, ['settings', 'lastBackupAt']);
  day(settings.lastBackupReminderOn, ['settings', 'lastBackupReminderOn']);
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
  Same<Plain<z.infer<typeof shoppingSchema>>, Plain<ShoppingRecord>>,
  Same<Plain<z.infer<typeof settingsSchema>>, Plain<UserSettings>>,
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
 * Migrations des formats d'export, indexées par version de DÉPART. Vide : la version 1 est
 * la première. Pour un format v2 : incrémenter `SNAPSHOT_SCHEMA_VERSION`, adapter le schéma
 * ci-dessus et ajouter ici `1: (raw) => ({ ...raw, schemaVersion: 2, … })`.
 */
export const SNAPSHOT_MIGRATIONS: Readonly<Record<number, SnapshotMigration>> = {};

const MAX_ERRORS = 5;

function formatIssues(issues: readonly z.ZodIssue[]): string[] {
  return issues.slice(0, MAX_ERRORS).map((i) => `${i.path.join('.') || '(racine)'}: ${i.message}`);
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
