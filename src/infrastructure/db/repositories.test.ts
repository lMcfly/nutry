import { afterEach, describe, expect, it } from 'vitest';
import { createUseCases } from '@application/usecases';
import {
  FakeBackupValidator,
  FakeCipher,
  FakePersistence,
  FixedClock,
  InMemoryExerciseCatalog,
  InMemoryPhotoCatalog,
  InMemoryQuizRepository,
  InMemoryRecipeRepository,
  RecordingFileSaver,
  RecordingSharer,
  SeededRandom,
} from '@application/testing';
import { INITIAL_COMPANION_STATE } from '@domain/companion';
import { INITIAL_QUIZ_STATE } from '@domain/quiz';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';
import { DEFAULT_SETTINGS, SNAPSHOT_SCHEMA_VERSION } from '@domain/userdata';
import type { RatingRecord, SavedPlan, UserDataSnapshot } from '@domain/userdata';
import { planTrainingWeek, trainingConstraintsKey } from '@domain/training';
import type { PainReport, SavedTrainingPlan, SessionLog } from '@domain/training';
import { makePlanInput, makeTraining } from '@domain/testing/training.fixtures';
import type { NutryDatabase } from './NutryDatabase';
import {
  DexiePlanRepository,
  DexieProfileRepository,
  DexieProgressRepository,
  DexieCompanionRepository,
  DexieQuizStateRepository,
  DexieRatingRepository,
  DexiePainReportRepository,
  DexieSessionLogRepository,
  DexieSettingsRepository,
  DexieShoppingRepository,
  DexieTrainingRepository,
  DexieUserDataStore,
} from './repositories';
import { createTestDatabase, dexieSportPorts } from './testing';

const plan = (weekStart: string): SavedPlan => ({
  weekStart,
  meals: [],
  notices: [],
  constraintsKey: 'k',
  generatedAt: `${weekStart}T08:00:00.000Z`,
});

const rating = (id: string, ratedAt: string): RatingRecord => ({
  id,
  recipeId: 'dahl',
  verdict: 'up',
  ratedAt,
});

let db: NutryDatabase;
afterEach(() => {
  db.close();
});

describe('dépôts Dexie', () => {
  it('profil, quiz et réglages : valeurs par défaut puis enregistrement', async () => {
    db = createTestDatabase();
    const profiles = new DexieProfileRepository(db);
    const quiz = new DexieQuizStateRepository(db);
    const settings = new DexieSettingsRepository(db);
    await expect(profiles.get()).resolves.toBeUndefined();
    await expect(quiz.get()).resolves.toEqual(INITIAL_QUIZ_STATE);
    await expect(settings.get()).resolves.toEqual(DEFAULT_SETTINGS);

    await profiles.save(makeProfile({ age: 40 }));
    await quiz.save({ seenIds: ['q1'], streak: 1, bestStreak: 2 });
    await settings.save({ theme: 'dark' });
    expect((await profiles.get())?.age).toBe(40);
    await expect(quiz.get()).resolves.toEqual({ seenIds: ['q1'], streak: 1, bestStreak: 2 });
    await expect(settings.get()).resolves.toEqual({ theme: 'dark' });
  });

  it('menus : par semaine, historique du plus récent au plus ancien', async () => {
    db = createTestDatabase();
    const plans = new DexiePlanRepository(db);
    await plans.save(plan('2026-11-16'));
    await plans.save(plan('2026-11-30'));
    await plans.save(plan('2026-11-23'));
    await plans.save({ ...plan('2026-11-23'), constraintsKey: 'k2' });
    expect((await plans.getByWeek('2026-11-23'))?.constraintsKey).toBe('k2');
    expect((await plans.list()).map((p) => p.weekStart)).toEqual([
      '2026-11-30',
      '2026-11-23',
      '2026-11-16',
    ]);
  });

  it('avis : remplacement par id, ordre chronologique, suppression', async () => {
    db = createTestDatabase();
    const ratings = new DexieRatingRepository(db);
    await ratings.save(rating('b', '2026-11-24T10:00:00.000Z'));
    await ratings.save(rating('a', '2026-11-23T10:00:00.000Z'));
    await ratings.save({ ...rating('b', '2026-11-25T10:00:00.000Z'), verdict: 'down' });
    const all = await ratings.getAll();
    expect(all.map((r) => [r.id, r.verdict])).toEqual([
      ['a', 'up'],
      ['b', 'down'],
    ]);
    await ratings.remove('a');
    await ratings.remove('inconnu');
    expect((await ratings.getAll()).map((r) => r.id)).toEqual(['b']);
  });

  it('progrès : tri par date, remplacement à la même date, suppression', async () => {
    db = createTestDatabase();
    const progress = new DexieProgressRepository(db);
    await progress.save({ date: '2026-11-30', weightKg: 61 });
    await progress.save({ date: '2026-11-23', weightKg: 62 });
    await progress.save({ date: '2026-11-23', waistCm: 75 });
    await expect(progress.list()).resolves.toEqual([
      { date: '2026-11-23', waistCm: 75 },
      { date: '2026-11-30', weightKg: 61 },
    ]);
    await progress.remove('2026-11-30');
    expect(await progress.list()).toHaveLength(1);
  });

  it('courses : un état par semaine', async () => {
    db = createTestDatabase();
    const shopping = new DexieShoppingRepository(db);
    const record = {
      weekStart: '2026-11-23',
      basisKey: 'x',
      state: { checkedKeys: ['oeufs|piece'], manualItems: [{ id: 'm1', label: 'Café' }] },
    };
    await shopping.save(record);
    await expect(shopping.get('2026-11-23')).resolves.toEqual(record);
    await expect(shopping.get('2026-11-30')).resolves.toBeUndefined();
  });
});

const trainingPlan = (weekStart: string): SavedTrainingPlan => {
  const input = makePlanInput({}, {}, { weekStart });
  return {
    ...planTrainingWeek(input),
    constraintsKey: trainingConstraintsKey(input.profile, input.training),
    generatedAt: `${weekStart}T08:00:00.000Z`,
  };
};

const sessionLog = (weekStart: string, sessionId: string, date: string): SessionLog => ({
  id: `${weekStart}:${sessionId}`,
  weekStart,
  sessionId,
  date,
  status: 'terminee',
  startedAt: `${date}T10:00:00.000Z`,
  completedAt: `${date}T11:00:00.000Z`,
  exercises: [
    {
      slotId: 'b0-s0',
      exerciseId: 'pompes',
      sets: [{ index: 0, done: true, reps: 10, loadKg: 5 }],
      done: true,
    },
  ],
});

const pain = (date: string, exerciseId: string): PainReport => ({
  id: `${date}:${exerciseId}`,
  date,
  exerciseId,
  muscles: ['pectoraux'],
});

describe('dépôts Dexie du Sport', () => {
  it('profil sportif : absent puis enregistré (singleton)', async () => {
    db = createTestDatabase();
    const training = new DexieTrainingRepository(db);
    await expect(training.getProfile()).resolves.toBeUndefined();
    await training.saveProfile(makeTraining({ goal: 'force' }));
    await training.saveProfile(makeTraining({ goal: 'endurance' }));
    expect((await training.getProfile())?.goal).toBe('endurance');
    await expect(db.trainingProfile.count()).resolves.toBe(1);
  });

  it('programmes : par semaine, remplacés à la même semaine, du plus récent au plus ancien', async () => {
    db = createTestDatabase();
    const training = new DexieTrainingRepository(db);
    await training.savePlan(trainingPlan('2026-11-16'));
    await training.savePlan(trainingPlan('2026-11-30'));
    await training.savePlan(trainingPlan('2026-11-23'));
    await training.savePlan({ ...trainingPlan('2026-11-23'), constraintsKey: 'k2' });
    expect((await training.getPlan('2026-11-23'))?.constraintsKey).toBe('k2');
    await expect(training.getPlan('2026-12-07')).resolves.toBeUndefined();
    expect((await training.listPlans()).map((p) => p.weekStart)).toEqual([
      '2026-11-30',
      '2026-11-23',
      '2026-11-16',
    ]);
  });

  it('journaux : par identifiant, par semaine, tous par date', async () => {
    db = createTestDatabase();
    const logs = new DexieSessionLogRepository(db);
    await logs.save(sessionLog('2026-11-23', 'd2', '2026-11-25'));
    await logs.save(sessionLog('2026-11-16', 'd0', '2026-11-16'));
    await logs.save(sessionLog('2026-11-23', 'd0', '2026-11-23'));
    await logs.save({ ...sessionLog('2026-11-23', 'd0', '2026-11-23'), status: 'en-cours' });
    expect((await logs.get('2026-11-23:d0'))?.status).toBe('en-cours');
    await expect(logs.get('absent')).resolves.toBeUndefined();
    expect((await logs.listByWeek('2026-11-23')).map((l) => l.id).sort()).toEqual([
      '2026-11-23:d0',
      '2026-11-23:d2',
    ]);
    expect((await logs.listAll()).map((l) => l.date)).toEqual([
      '2026-11-16',
      '2026-11-23',
      '2026-11-25',
    ]);
  });

  it('douleurs : un signalement par jour et exercice, par date', async () => {
    db = createTestDatabase();
    const reports = new DexiePainReportRepository(db);
    await reports.save(pain('2026-11-25', 'pompes'));
    await reports.save(pain('2026-11-20', 'squat'));
    await reports.save({ ...pain('2026-11-25', 'pompes'), muscles: ['triceps'] });
    const all = await reports.list();
    expect(all.map((r) => r.id)).toEqual(['2026-11-20:squat', '2026-11-25:pompes']);
    expect(all[1]?.muscles).toEqual(['triceps']);
  });

  it('exporte, importe atomiquement et efface toutes les données du Sport', async () => {
    db = createTestDatabase();
    const store = new DexieUserDataStore(db);
    const snapshot: UserDataSnapshot = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      plans: [],
      ratings: [],
      progress: [],
      quiz: INITIAL_QUIZ_STATE,
      companion: INITIAL_COMPANION_STATE,
      shopping: [],
      settings: { theme: 'system', activitySuggestionDismissedOn: '2026-11-25' },
      training: makeTraining(),
      trainingPlans: [trainingPlan('2026-11-23')],
      sessionLogs: [sessionLog('2026-11-23', 'd0', '2026-11-23')],
      painReports: [pain('2026-11-25', 'pompes')],
    };
    await store.importAll(snapshot);
    await expect(store.exportAll()).resolves.toEqual(snapshot);
    // Un import remplace tout, Sport compris (ici : sans profil sportif).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { training: _training, ...withoutTraining } = snapshot;
    await store.importAll({ ...withoutTraining, sessionLogs: [], painReports: [] });
    const replaced = await store.exportAll();
    expect(replaced.training).toBeUndefined();
    expect(replaced.sessionLogs).toEqual([]);
    expect(replaced.trainingPlans).toHaveLength(1);
    await store.importAll(snapshot);
    await store.clearAll();
    for (const table of [db.trainingProfile, db.trainingPlans, db.sessionLogs, db.painReports]) {
      await expect(table.count()).resolves.toBe(0);
    }
  });
});

describe('DexieUserDataStore', () => {
  const snapshot: UserDataSnapshot = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    profile: makeProfile(),
    plans: [plan('2026-11-23')],
    ratings: [rating('r1', '2026-11-23T10:00:00.000Z')],
    progress: [{ date: '2026-11-23', weightKg: 62 }],
    quiz: { seenIds: ['q1'], streak: 3, bestStreak: 4 },
    companion: {
      ...INITIAL_COMPANION_STATE,
      lastActiveDay: '2026-11-23',
      streak: 2,
      best: 5,
      acknowledgedBest: 3,
    },
    shopping: [
      { weekStart: '2026-11-23', basisKey: 'b', state: { checkedKeys: [], manualItems: [] } },
    ],
    settings: { theme: 'light', lastBackupAt: '2026-11-23T10:00:00.000Z' },
    trainingPlans: [],
    sessionLogs: [],
    painReports: [],
  };

  it('exporte une base vide avec les valeurs par défaut', async () => {
    db = createTestDatabase();
    await expect(new DexieUserDataStore(db).exportAll()).resolves.toEqual({
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
  });

  it('importe en remplaçant tout, puis réexporte à l’identique', async () => {
    db = createTestDatabase();
    const store = new DexieUserDataStore(db);
    await new DexiePlanRepository(db).save(plan('2020-01-06'));
    await new DexieProgressRepository(db).save({ date: '2020-01-06', waistCm: 80 });
    await store.importAll(snapshot);
    await expect(store.exportAll()).resolves.toEqual(snapshot);
  });

  it('importe un instantané sans profil (le profil existant disparaît)', async () => {
    db = createTestDatabase();
    const store = new DexieUserDataStore(db);
    await new DexieProfileRepository(db).save(makeProfile());
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { profile, ...withoutProfile } = snapshot;
    await store.importAll(withoutProfile);
    await expect(new DexieProfileRepository(db).get()).resolves.toBeUndefined();
  });

  it('import atomique : en cas d’échec, rien n’est modifié', async () => {
    db = createTestDatabase();
    const store = new DexieUserDataStore(db);
    await store.importAll(snapshot);
    // Une clé primaire invalide (objet) fait échouer l'écriture au milieu de la transaction.
    const broken = {
      ...snapshot,
      profile: makeProfile({ age: 50 }),
      progress: [{ date: {} as unknown as string, weightKg: 1 }],
    };
    await expect(store.importAll(broken)).rejects.toThrow();
    await expect(store.exportAll()).resolves.toEqual(snapshot);
  });

  it('efface tout', async () => {
    db = createTestDatabase();
    const store = new DexieUserDataStore(db);
    await store.importAll(snapshot);
    await store.clearAll();
    const empty = await store.exportAll();
    expect(empty.profile).toBeUndefined();
    expect(empty.plans).toEqual([]);
    expect(empty.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe('cas d’usage branchés sur Dexie', () => {
  it('parcours complet : profil, menu, avis, courses, export, effacement, import', async () => {
    db = createTestDatabase();
    const ports = {
      clock: new FixedClock(),
      random: new SeededRandom(),
      profiles: new DexieProfileRepository(db),
      plans: new DexiePlanRepository(db),
      ratings: new DexieRatingRepository(db),
      progress: new DexieProgressRepository(db),
      quizBank: new InMemoryQuizRepository([]),
      quizState: new DexieQuizStateRepository(db),
      companion: new DexieCompanionRepository(db),
      shopping: new DexieShoppingRepository(db),
      settings: new DexieSettingsRepository(db),
      recipes: new InMemoryRecipeRepository(FIXTURE_RECIPES),
      photos: new InMemoryPhotoCatalog([]),
      exercises: new InMemoryExerciseCatalog(),
      sharer: new RecordingSharer(),
      userData: new DexieUserDataStore(db),
      cipher: new FakeCipher(),
      backupValidator: new FakeBackupValidator(),
      persistence: new FakePersistence(),
      fileSaver: new RecordingFileSaver(),
      ...dexieSportPorts(db),
    };
    const uc = createUseCases(ports);
    await uc.saveProfile(makeProfile());
    const view = await uc.getCurrentPlan();
    if (view.status !== 'ready') throw new Error('menu attendu');
    const meal = view.plan.meals[0];
    if (!meal) throw new Error('repas attendu');
    await uc.rateMeal({ weekStart: view.plan.weekStart, mealId: meal.id, verdict: 'up' });
    await uc.addShoppingItem({ label: 'Café' });
    await uc.exportData();
    const content = ports.fileSaver.files[0]?.content ?? '';

    await uc.wipeAllData();
    await expect(uc.getProfile()).resolves.toBeUndefined();
    await expect(uc.importData({ content })).resolves.toMatchObject({ status: 'imported' });
    const restored = await uc.getCurrentPlan();
    expect(restored.status === 'ready' && restored.plan).toEqual(view.plan);
    expect(restored.status === 'ready' && restored.ratings[meal.id]?.verdict).toBe('up');
  });
});
