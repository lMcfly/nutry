import type {
  CompanionRepository,
  PainReportRepository,
  PlanRepository,
  ProfileRepository,
  ProgressRepository,
  QuizStateRepository,
  RatingRepository,
  SessionLogRepository,
  SettingsRepository,
  ShoppingRepository,
  TrainingRepository,
  UserDataStore,
} from '@application/ports';
import { INITIAL_COMPANION_STATE } from '@domain/companion';
import type { CompanionState } from '@domain/companion';
import type { Profile } from '@domain/profile';
import type { ProgressEntry } from '@domain/progress';
import { INITIAL_QUIZ_STATE } from '@domain/quiz';
import type { QuizState } from '@domain/quiz';
import type { IsoDate } from '@domain/shared';
import type { PainReport, SavedTrainingPlan, SessionLog, TrainingProfile } from '@domain/training';
import { DEFAULT_SETTINGS, SNAPSHOT_SCHEMA_VERSION } from '@domain/userdata';
import type {
  RatingRecord,
  SavedPlan,
  ShoppingRecord,
  UserDataSnapshot,
  UserSettings,
} from '@domain/userdata';
import type { NutryDatabase } from './NutryDatabase';
import { SINGLETON_KEY } from './schema';

export class DexieProfileRepository implements ProfileRepository {
  constructor(private readonly db: NutryDatabase) {}
  async get(): Promise<Profile | undefined> {
    return (await this.db.profile.get(SINGLETON_KEY))?.profile;
  }
  async save(profile: Profile): Promise<void> {
    await this.db.profile.put({ id: SINGLETON_KEY, profile });
  }
}

export class DexiePlanRepository implements PlanRepository {
  constructor(private readonly db: NutryDatabase) {}
  getByWeek(weekStart: IsoDate): Promise<SavedPlan | undefined> {
    return this.db.plans.get(weekStart);
  }
  async save(plan: SavedPlan): Promise<void> {
    await this.db.plans.put(plan);
  }
  list(): Promise<readonly SavedPlan[]> {
    return this.db.plans.reverse().toArray();
  }
}

export class DexieRatingRepository implements RatingRepository {
  constructor(private readonly db: NutryDatabase) {}
  async save(rating: RatingRecord): Promise<void> {
    await this.db.ratings.put(rating);
  }
  getAll(): Promise<readonly RatingRecord[]> {
    return this.db.ratings.orderBy('ratedAt').toArray();
  }
  remove(id: string): Promise<void> {
    return this.db.ratings.delete(id);
  }
}

export class DexieProgressRepository implements ProgressRepository {
  constructor(private readonly db: NutryDatabase) {}
  async save(entry: ProgressEntry): Promise<void> {
    await this.db.progress.put(entry);
  }
  list(): Promise<readonly ProgressEntry[]> {
    return this.db.progress.toArray();
  }
  remove(date: IsoDate): Promise<void> {
    return this.db.progress.delete(date);
  }
}

export class DexieQuizStateRepository implements QuizStateRepository {
  constructor(private readonly db: NutryDatabase) {}
  async get(): Promise<QuizState> {
    return (await this.db.quiz.get(SINGLETON_KEY))?.state ?? INITIAL_QUIZ_STATE;
  }
  async save(state: QuizState): Promise<void> {
    await this.db.quiz.put({ id: SINGLETON_KEY, state });
  }
}

export class DexieCompanionRepository implements CompanionRepository {
  constructor(private readonly db: NutryDatabase) {}
  async get(): Promise<CompanionState> {
    return (await this.db.companion.get(SINGLETON_KEY))?.state ?? INITIAL_COMPANION_STATE;
  }
  async save(state: CompanionState): Promise<void> {
    await this.db.companion.put({ id: SINGLETON_KEY, state });
  }
}

export class DexieShoppingRepository implements ShoppingRepository {
  constructor(private readonly db: NutryDatabase) {}
  get(weekStart: IsoDate): Promise<ShoppingRecord | undefined> {
    return this.db.shopping.get(weekStart);
  }
  async save(record: ShoppingRecord): Promise<void> {
    await this.db.shopping.put(record);
  }
}

export class DexieSettingsRepository implements SettingsRepository {
  constructor(private readonly db: NutryDatabase) {}
  async get(): Promise<UserSettings> {
    return (await this.db.settings.get(SINGLETON_KEY))?.settings ?? DEFAULT_SETTINGS;
  }
  async save(settings: UserSettings): Promise<void> {
    await this.db.settings.put({ id: SINGLETON_KEY, settings });
  }
}

export class DexieTrainingRepository implements TrainingRepository {
  constructor(private readonly db: NutryDatabase) {}
  async getProfile(): Promise<TrainingProfile | undefined> {
    return (await this.db.trainingProfile.get(SINGLETON_KEY))?.profile;
  }
  async saveProfile(profile: TrainingProfile): Promise<void> {
    await this.db.trainingProfile.put({ id: SINGLETON_KEY, profile });
  }
  getPlan(weekStart: IsoDate): Promise<SavedTrainingPlan | undefined> {
    return this.db.trainingPlans.get(weekStart);
  }
  async savePlan(plan: SavedTrainingPlan): Promise<void> {
    await this.db.trainingPlans.put(plan);
  }
  listPlans(): Promise<readonly SavedTrainingPlan[]> {
    return this.db.trainingPlans.reverse().toArray();
  }
}

export class DexieSessionLogRepository implements SessionLogRepository {
  constructor(private readonly db: NutryDatabase) {}
  get(id: string): Promise<SessionLog | undefined> {
    return this.db.sessionLogs.get(id);
  }
  async save(log: SessionLog): Promise<void> {
    await this.db.sessionLogs.put(log);
  }
  listByWeek(weekStart: IsoDate): Promise<readonly SessionLog[]> {
    return this.db.sessionLogs.where('weekStart').equals(weekStart).toArray();
  }
  listAll(): Promise<readonly SessionLog[]> {
    return this.db.sessionLogs.orderBy('date').toArray();
  }
}

export class DexiePainReportRepository implements PainReportRepository {
  constructor(private readonly db: NutryDatabase) {}
  async save(report: PainReport): Promise<void> {
    await this.db.painReports.put(report);
  }
  list(): Promise<readonly PainReport[]> {
    return this.db.painReports.orderBy('date').toArray();
  }
}

/** Export, import et effacement de toutes les tables, chacun en UNE transaction. */
export class DexieUserDataStore implements UserDataStore {
  constructor(private readonly db: NutryDatabase) {}

  exportAll(): Promise<UserDataSnapshot> {
    const { db } = this;
    return db.transaction('r', db.userTables, async () => {
      const [
        profile,
        plans,
        ratings,
        progress,
        quiz,
        companion,
        shopping,
        settings,
        training,
        trainingPlans,
        sessionLogs,
        painReports,
      ] = await Promise.all([
        db.profile.get(SINGLETON_KEY),
        db.plans.toArray(),
        db.ratings.orderBy('ratedAt').toArray(),
        db.progress.toArray(),
        db.quiz.get(SINGLETON_KEY),
        db.companion.get(SINGLETON_KEY),
        db.shopping.toArray(),
        db.settings.get(SINGLETON_KEY),
        db.trainingProfile.get(SINGLETON_KEY),
        db.trainingPlans.toArray(),
        db.sessionLogs.toArray(),
        db.painReports.toArray(),
      ]);
      return {
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        ...(profile ? { profile: profile.profile } : {}),
        plans,
        ratings,
        progress,
        quiz: quiz?.state ?? INITIAL_QUIZ_STATE,
        companion: companion?.state ?? INITIAL_COMPANION_STATE,
        shopping,
        settings: settings?.settings ?? DEFAULT_SETTINGS,
        ...(training ? { training: training.profile } : {}),
        trainingPlans,
        sessionLogs,
        painReports,
      };
    });
  }

  importAll(snapshot: UserDataSnapshot): Promise<void> {
    const { db } = this;
    return db.transaction('rw', db.userTables, async () => {
      await Promise.all(db.userTables.map((table) => table.clear()));
      await Promise.all([
        snapshot.profile ? db.profile.put({ id: SINGLETON_KEY, profile: snapshot.profile }) : null,
        db.plans.bulkPut([...snapshot.plans]),
        db.ratings.bulkPut([...snapshot.ratings]),
        db.progress.bulkPut([...snapshot.progress]),
        db.quiz.put({ id: SINGLETON_KEY, state: snapshot.quiz }),
        db.companion.put({ id: SINGLETON_KEY, state: snapshot.companion }),
        db.shopping.bulkPut([...snapshot.shopping]),
        db.settings.put({ id: SINGLETON_KEY, settings: snapshot.settings }),
        snapshot.training
          ? db.trainingProfile.put({ id: SINGLETON_KEY, profile: snapshot.training })
          : null,
        db.trainingPlans.bulkPut([...snapshot.trainingPlans]),
        db.sessionLogs.bulkPut([...snapshot.sessionLogs]),
        db.painReports.bulkPut([...snapshot.painReports]),
      ]);
    });
  }

  clearAll(): Promise<void> {
    const { db } = this;
    return db.transaction('rw', db.userTables, async () => {
      await Promise.all(db.userTables.map((table) => table.clear()));
    });
  }
}
