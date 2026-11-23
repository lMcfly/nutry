/**
 * Fakes en mémoire de tous les ports : tests de l'application et de la présentation.
 * Jamais utilisés en production (la composition root branche l'infrastructure).
 */
import type {
  BackupParseResult,
  BackupValidator,
  Cipher,
  Clock,
  EncryptedPayload,
  FileSaver,
  FileToSave,
  PlanRepository,
  ProfileRepository,
  ProgressRepository,
  QuizRepository,
  QuizStateRepository,
  RandomSource,
  RatingRepository,
  RecipeRepository,
  SettingsRepository,
  ShareResult,
  Sharer,
  ShoppingRepository,
  StoragePersistence,
  UserDataStore,
} from '../ports';
import type { AppPorts } from '../usecases/context';
import type { Profile } from '@domain/profile';
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
  shopping: Map<IsoDate, ShoppingRecord>;
  settings: UserSettings;
}

export function emptyState(): InMemoryState {
  return {
    plans: new Map(),
    ratings: new Map(),
    progress: new Map(),
    quiz: INITIAL_QUIZ_STATE,
    shopping: new Map(),
    settings: DEFAULT_SETTINGS,
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
      shopping: [...s.shopping.values()],
      settings: s.settings,
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
      shopping: [],
      settings: DEFAULT_SETTINGS,
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
    s.shopping = new Map(snapshot.shopping.map((r) => [r.weekStart, r]));
    s.settings = snapshot.settings;
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

export interface InMemoryPorts extends AppPorts {
  readonly clock: FixedClock;
  readonly recipes: InMemoryRecipeRepository;
  readonly quizBank: InMemoryQuizRepository;
  readonly sharer: RecordingSharer;
  readonly fileSaver: RecordingFileSaver;
  readonly persistence: FakePersistence;
  /** Données « en base », inspectables par les tests. */
  readonly state: InMemoryState;
}

export function createInMemoryPorts(
  options: {
    readonly recipes?: readonly Recipe[];
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
    shopping: new InMemoryShoppingRepository(state),
    settings: new InMemorySettingsRepository(state),
    recipes: new InMemoryRecipeRepository(options.recipes ?? []),
    sharer: new RecordingSharer(options.shareResult),
    userData: new InMemoryUserDataStore(state),
    cipher: new FakeCipher(),
    backupValidator: new FakeBackupValidator(),
    persistence: new FakePersistence(options.grantPersistence),
    fileSaver: new RecordingFileSaver(),
  };
}
