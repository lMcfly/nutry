/**
 * Fakes en mémoire de tous les ports : tests de l'application et de la présentation.
 * Jamais utilisés en production (la composition root branche l'infrastructure).
 */
import type {
  BackupParseResult,
  BackupValidator,
  Cipher,
  Clock,
  CompanionRepository,
  DeviceStorage,
  DeviceStorageScope,
  EncryptedPayload,
  FileSaver,
  FileToSave,
  ExerciseCatalog,
  ExerciseMedia,
  PainReportRepository,
  PhotoCatalog,
  PlanRepository,
  ProfileRepository,
  ProgressRepository,
  QuizRepository,
  QuizStateRepository,
  RandomSource,
  RatingRepository,
  RecipePhoto,
  RecipeRepository,
  ScreenWakeLock,
  SessionLogRepository,
  SettingsRepository,
  ShareResult,
  Sharer,
  ShoppingRepository,
  StoragePersistence,
  TrainingRepository,
  UserDataStore,
} from '../ports';
import type { AppPorts } from '../usecases/context';
import { INITIAL_COMPANION_STATE } from '@domain/companion';
import type { CompanionState } from '@domain/companion';
import type { Profile } from '@domain/profile';
import type {
  Exercise,
  PainReport,
  SavedTrainingPlan,
  SessionLog,
  TrainingProfile,
} from '@domain/training';
import type { ProgressEntry } from '@domain/progress';
import { INITIAL_QUIZ_STATE } from '@domain/quiz';
import type { QuizQuestion, QuizState } from '@domain/quiz';
import type { Recipe } from '@domain/recipe';
import { createSeededRng } from '@domain/shared';
import type { IsoDate } from '@domain/shared';
import { DEFAULT_SETTINGS, SNAPSHOT_SCHEMA_VERSION } from '@domain/userdata';
import type {
  RatingRecord,
  SavedPlan,
  ShoppingRecord,
  UserDataSnapshot,
  UserSettings,
} from '@domain/userdata';

/**
 * Horloge réglable. Les jours locaux sont ceux d'un fuseau à décalage fixe
 * (`utcOffsetMinutes`, 0 par défaut : `today` est alors la partie date de l'instant UTC).
 */
export class FixedClock implements Clock {
  private instant: string;
  constructor(
    instant = '2026-11-23T10:00:00.000Z',
    private readonly utcOffsetMinutes = 0,
  ) {
    this.instant = instant;
  }
  set(instant: string): void {
    this.instant = instant;
  }
  now(): Date {
    return new Date(this.instant);
  }
  today(): IsoDate {
    return this.dayOf(this.now());
  }
  dayOf(instant: Date): IsoDate {
    return new Date(instant.getTime() + this.utcOffsetMinutes * 60_000).toISOString().slice(0, 10);
  }
}

export class SeededRandom implements RandomSource {
  private readonly rng: () => number;
  constructor(seed = 42) {
    this.rng = createSeededRng(seed);
  }
  next(): number {
    return this.rng();
  }
}

/** État partagé par les dépôts en mémoire (comme une base). */
export interface InMemoryState {
  profile?: Profile;
  plans: Map<IsoDate, SavedPlan>;
  ratings: Map<string, RatingRecord>;
  progress: Map<IsoDate, ProgressEntry>;
  quiz: QuizState;
  companion: CompanionState;
  shopping: Map<IsoDate, ShoppingRecord>;
  settings: UserSettings;
  training?: TrainingProfile;
  trainingPlans: Map<IsoDate, SavedTrainingPlan>;
  sessionLogs: Map<string, SessionLog>;
  painReports: Map<string, PainReport>;
}

export function emptyState(): InMemoryState {
  return {
    plans: new Map(),
    ratings: new Map(),
    progress: new Map(),
    quiz: INITIAL_QUIZ_STATE,
    companion: INITIAL_COMPANION_STATE,
    shopping: new Map(),
    settings: DEFAULT_SETTINGS,
    trainingPlans: new Map(),
    sessionLogs: new Map(),
    painReports: new Map(),
  };
}

export class InMemoryProfileRepository implements ProfileRepository {
  constructor(private readonly state: InMemoryState) {}
  get() {
    return Promise.resolve(this.state.profile);
  }
  save(profile: Profile) {
    this.state.profile = profile;
    return Promise.resolve();
  }
}

export class InMemoryPlanRepository implements PlanRepository {
  constructor(private readonly state: InMemoryState) {}
  getByWeek(weekStart: IsoDate) {
    return Promise.resolve(this.state.plans.get(weekStart));
  }
  save(plan: SavedPlan) {
    this.state.plans.set(plan.weekStart, plan);
    return Promise.resolve();
  }
  list() {
    return Promise.resolve(
      [...this.state.plans.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    );
  }
}

export class InMemoryRatingRepository implements RatingRepository {
  constructor(private readonly state: InMemoryState) {}
  save(rating: RatingRecord) {
    this.state.ratings.set(rating.id, rating);
    return Promise.resolve();
  }
  getAll() {
    return Promise.resolve(
      [...this.state.ratings.values()].sort((a, b) => a.ratedAt.localeCompare(b.ratedAt)),
    );
  }
  remove(id: string) {
    this.state.ratings.delete(id);
    return Promise.resolve();
  }
}

export class InMemoryProgressRepository implements ProgressRepository {
  constructor(private readonly state: InMemoryState) {}
  save(entry: ProgressEntry) {
    this.state.progress.set(entry.date, entry);
    return Promise.resolve();
  }
  list() {
    return Promise.resolve(
      [...this.state.progress.values()].sort((a, b) => a.date.localeCompare(b.date)),
    );
  }
  remove(date: IsoDate) {
    this.state.progress.delete(date);
    return Promise.resolve();
  }
}

export class InMemoryQuizStateRepository implements QuizStateRepository {
  constructor(private readonly state: InMemoryState) {}
  get() {
    return Promise.resolve(this.state.quiz);
  }
  save(quiz: QuizState) {
    this.state.quiz = quiz;
    return Promise.resolve();
  }
}

export class InMemoryCompanionRepository implements CompanionRepository {
  constructor(private readonly state: InMemoryState) {}
  get() {
    return Promise.resolve(this.state.companion);
  }
  save(companion: CompanionState) {
    this.state.companion = companion;
    return Promise.resolve();
  }
}

export class InMemoryShoppingRepository implements ShoppingRepository {
  constructor(private readonly state: InMemoryState) {}
  get(weekStart: IsoDate) {
    return Promise.resolve(this.state.shopping.get(weekStart));
  }
  save(record: ShoppingRecord) {
    this.state.shopping.set(record.weekStart, record);
    return Promise.resolve();
  }
}

export class InMemorySettingsRepository implements SettingsRepository {
  constructor(private readonly state: InMemoryState) {}
  get() {
    return Promise.resolve(this.state.settings);
  }
  save(settings: UserSettings) {
    this.state.settings = settings;
    return Promise.resolve();
  }
}

export class InMemoryTrainingRepository implements TrainingRepository {
  constructor(private readonly state: InMemoryState) {}
  getProfile() {
    return Promise.resolve(this.state.training);
  }
  saveProfile(profile: TrainingProfile) {
    this.state.training = profile;
    return Promise.resolve();
  }
  getPlan(weekStart: IsoDate) {
    return Promise.resolve(this.state.trainingPlans.get(weekStart));
  }
  savePlan(plan: SavedTrainingPlan) {
    this.state.trainingPlans.set(plan.weekStart, plan);
    return Promise.resolve();
  }
  listPlans() {
    return Promise.resolve(
      [...this.state.trainingPlans.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    );
  }
}

export class InMemorySessionLogRepository implements SessionLogRepository {
  constructor(private readonly state: InMemoryState) {}
  get(id: string) {
    return Promise.resolve(this.state.sessionLogs.get(id));
  }
  save(log: SessionLog) {
    this.state.sessionLogs.set(log.id, log);
    return Promise.resolve();
  }
  listByWeek(weekStart: IsoDate) {
    return Promise.resolve(
      [...this.state.sessionLogs.values()].filter((log) => log.weekStart === weekStart),
    );
  }
  listAll() {
    return Promise.resolve(
      [...this.state.sessionLogs.values()].sort(
        (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
      ),
    );
  }
}

export class InMemoryPainReportRepository implements PainReportRepository {
  constructor(private readonly state: InMemoryState) {}
  save(report: PainReport) {
    this.state.painReports.set(report.id, report);
    return Promise.resolve();
  }
  list() {
    return Promise.resolve(
      [...this.state.painReports.values()].sort((a, b) => a.date.localeCompare(b.date)),
    );
  }
}

/** Verrou d'écran factice : compte les demandes et les relâchements. */
export class FakeScreenWakeLock implements ScreenWakeLock {
  held = false;
  acquisitions = 0;
  releases = 0;
  constructor(private readonly supported = true) {}
  acquire() {
    this.acquisitions += 1;
    this.held = this.supported;
    return Promise.resolve(this.supported);
  }
  release() {
    this.releases += 1;
    this.held = false;
    return Promise.resolve();
  }
}

export class InMemoryUserDataStore implements UserDataStore {
  constructor(private readonly state: InMemoryState) {}
  exportAll(): Promise<UserDataSnapshot> {
    const s = this.state;
    return Promise.resolve({
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      ...(s.profile ? { profile: s.profile } : {}),
      plans: [...s.plans.values()],
      ratings: [...s.ratings.values()],
      progress: [...s.progress.values()],
      quiz: s.quiz,
      companion: s.companion,
      shopping: [...s.shopping.values()],
      settings: s.settings,
      ...(s.training ? { training: s.training } : {}),
      trainingPlans: [...s.trainingPlans.values()],
      sessionLogs: [...s.sessionLogs.values()],
      painReports: [...s.painReports.values()],
    });
  }
  importAll(snapshot: UserDataSnapshot) {
    this.replace(snapshot);
    return Promise.resolve();
  }
  clearAll() {
    this.replace({
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      plans: [],
      ratings: [],
      progress: [],
      quiz: INITIAL_QUIZ_STATE,
      companion: INITIAL_COMPANION_STATE,
      shopping: [],
      settings: DEFAULT_SETTINGS,
      trainingPlans: [],
      sessionLogs: [],
      painReports: [],
    });
    return Promise.resolve();
  }
  private replace(snapshot: UserDataSnapshot): void {
    const s = this.state;
    if (snapshot.profile) s.profile = snapshot.profile;
    else delete s.profile;
    s.plans = new Map(snapshot.plans.map((p) => [p.weekStart, p]));
    s.ratings = new Map(snapshot.ratings.map((r) => [r.id, r]));
    s.progress = new Map(snapshot.progress.map((p) => [p.date, p]));
    s.quiz = snapshot.quiz;
    s.companion = snapshot.companion;
    s.shopping = new Map(snapshot.shopping.map((r) => [r.weekStart, r]));
    s.settings = snapshot.settings;
    if (snapshot.training) s.training = snapshot.training;
    else delete s.training;
    s.trainingPlans = new Map(snapshot.trainingPlans.map((p) => [p.weekStart, p]));
    s.sessionLogs = new Map(snapshot.sessionLogs.map((l) => [l.id, l]));
    s.painReports = new Map(snapshot.painReports.map((r) => [r.id, r]));
  }
}

export class InMemoryRecipeRepository implements RecipeRepository {
  constructor(public recipes: readonly Recipe[]) {}
  getAll() {
    return Promise.resolve(this.recipes);
  }
  getById(id: string) {
    return Promise.resolve(this.recipes.find((r) => r.id === id));
  }
}

export class InMemoryExerciseCatalog implements ExerciseCatalog {
  constructor(
    public exercises: readonly Exercise[] = [],
    public media: readonly ExerciseMedia[] = [],
  ) {}
  getExercises(): Promise<readonly Exercise[]> {
    return Promise.resolve(this.exercises);
  }
  getMedia(exerciseId: string): Promise<ExerciseMedia | undefined> {
    return Promise.resolve(this.media.find((m) => m.exerciseId === exerciseId));
  }
}

export class InMemoryPhotoCatalog implements PhotoCatalog {
  constructor(public photos: readonly RecipePhoto[]) {}
  getAll() {
    return Promise.resolve(this.photos);
  }
}

export class InMemoryQuizRepository implements QuizRepository {
  constructor(public questions: readonly QuizQuestion[]) {}
  getQuestions() {
    return Promise.resolve(this.questions);
  }
}

export class RecordingSharer implements Sharer {
  readonly shared: string[] = [];
  constructor(private readonly result: ShareResult = 'shared') {}
  share(text: string) {
    this.shared.push(text);
    return Promise.resolve(this.result);
  }
}

export class RecordingFileSaver implements FileSaver {
  readonly files: FileToSave[] = [];
  save(file: FileToSave) {
    this.files.push(file);
    return Promise.resolve();
  }
}

export class FakePersistence implements StoragePersistence {
  persisted = false;
  constructor(private readonly grant = true) {}
  request() {
    this.persisted = this.grant;
    return Promise.resolve(this.grant);
  }
  isPersisted() {
    return Promise.resolve(this.persisted);
  }
}

/** Chiffrement factice réversible : la « clé » est la phrase, rien n'est secret. */
export class FakeCipher implements Cipher {
  encrypt(plaintext: string, passphrase: string): Promise<EncryptedPayload> {
    return Promise.resolve({
      v: 1,
      alg: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iter: 310_000,
      salt: passphrase,
      iv: 'iv',
      data: plaintext,
    });
  }
  decrypt(payload: EncryptedPayload, passphrase: string): Promise<string> {
    return payload.salt === passphrase
      ? Promise.resolve(payload.data)
      : Promise.reject(new Error('phrase secrète incorrecte'));
  }
}

const isRecord = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === 'object' && raw !== null;

/** Validateur factice : fait confiance à la forme, vérifie le marqueur et la version. */
export class FakeBackupValidator implements BackupValidator {
  parseBackup(raw: unknown): Promise<BackupParseResult> {
    if (!isRecord(raw) || raw['app'] !== 'nutry' || typeof raw['schemaVersion'] !== 'number') {
      return Promise.resolve({ ok: false, reason: 'invalide', errors: ['app: attendu « nutry »'] });
    }
    if (raw['schemaVersion'] > SNAPSHOT_SCHEMA_VERSION) {
      return Promise.resolve({ ok: false, reason: 'version-future', errors: [] });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { app, exportedAt, ...snapshot } = raw;
    return Promise.resolve({
      ok: true,
      snapshot: snapshot as unknown as UserDataSnapshot,
      ...(typeof exportedAt === 'string' ? { exportedAt } : {}),
    });
  }
  parseEncrypted(raw: unknown): Promise<EncryptedPayload | undefined> {
    return Promise.resolve(
      isRecord(raw) && raw['alg'] === 'AES-GCM' ? (raw as unknown as EncryptedPayload) : undefined,
    );
  }
}

/** Stockage d'appareil en mémoire (thème mis en cache, drapeaux de session). */
export class InMemoryDeviceStorage implements DeviceStorage {
  readonly values: Record<DeviceStorageScope, Map<string, string>> = {
    local: new Map(),
    session: new Map(),
  };
  get(scope: DeviceStorageScope, key: string) {
    return this.values[scope].get(key);
  }
  set(scope: DeviceStorageScope, key: string, value: string) {
    this.values[scope].set(key, value);
  }
  clear() {
    this.values.local.clear();
    this.values.session.clear();
  }
}

export interface InMemoryPorts extends AppPorts {
  readonly clock: FixedClock;
  readonly recipes: InMemoryRecipeRepository;
  readonly photos: InMemoryPhotoCatalog;
  readonly exercises: InMemoryExerciseCatalog;
  readonly wakeLock: FakeScreenWakeLock;
  readonly quizBank: InMemoryQuizRepository;
  readonly sharer: RecordingSharer;
  readonly fileSaver: RecordingFileSaver;
  readonly persistence: FakePersistence;
  readonly device: InMemoryDeviceStorage;
  /** Données « en base », inspectables par les tests. */
  readonly state: InMemoryState;
}

export function createInMemoryPorts(
  options: {
    readonly recipes?: readonly Recipe[];
    readonly photos?: readonly RecipePhoto[];
    readonly exercises?: readonly Exercise[];
    readonly exerciseMedia?: readonly ExerciseMedia[];
    readonly wakeLockSupported?: boolean;
    readonly questions?: readonly QuizQuestion[];
    readonly clock?: FixedClock;
    readonly seed?: number;
    readonly shareResult?: ShareResult;
    readonly grantPersistence?: boolean;
  } = {},
): InMemoryPorts {
  const state = emptyState();
  return {
    state,
    clock: options.clock ?? new FixedClock(),
    random: new SeededRandom(options.seed),
    profiles: new InMemoryProfileRepository(state),
    plans: new InMemoryPlanRepository(state),
    ratings: new InMemoryRatingRepository(state),
    progress: new InMemoryProgressRepository(state),
    quizBank: new InMemoryQuizRepository(options.questions ?? []),
    quizState: new InMemoryQuizStateRepository(state),
    companion: new InMemoryCompanionRepository(state),
    shopping: new InMemoryShoppingRepository(state),
    settings: new InMemorySettingsRepository(state),
    recipes: new InMemoryRecipeRepository(options.recipes ?? []),
    photos: new InMemoryPhotoCatalog(options.photos ?? []),
    exercises: new InMemoryExerciseCatalog(options.exercises ?? [], options.exerciseMedia ?? []),
    training: new InMemoryTrainingRepository(state),
    sessionLogs: new InMemorySessionLogRepository(state),
    painReports: new InMemoryPainReportRepository(state),
    wakeLock: new FakeScreenWakeLock(options.wakeLockSupported),
    sharer: new RecordingSharer(options.shareResult),
    userData: new InMemoryUserDataStore(state),
    cipher: new FakeCipher(),
    backupValidator: new FakeBackupValidator(),
    persistence: new FakePersistence(options.grantPersistence),
    fileSaver: new RecordingFileSaver(),
    device: new InMemoryDeviceStorage(),
  };
}
