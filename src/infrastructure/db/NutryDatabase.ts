import Dexie from 'dexie';
import type { DexieOptions, Table } from 'dexie';
import type { CompanionState } from '@domain/companion';
import type { Profile } from '@domain/profile';
import type { ProgressEntry } from '@domain/progress';
import type { QuizState } from '@domain/quiz';
import type { IsoDate } from '@domain/shared';
import type { PainReport, SavedTrainingPlan, SessionLog, TrainingProfile } from '@domain/training';
import type { RatingRecord, SavedPlan, ShoppingRecord, UserSettings } from '@domain/userdata';
import { DB_NAME, DB_VERSIONS } from './schema';
import type { DbVersion } from './schema';

export interface ProfileRow {
  readonly id: string;
  readonly profile: Profile;
}
export interface QuizRow {
  readonly id: string;
  readonly state: QuizState;
}
export interface CompanionRow {
  readonly id: string;
  readonly state: CompanionState;
}
export interface TrainingProfileRow {
  readonly id: string;
  readonly profile: TrainingProfile;
}
export interface SettingsRow {
  readonly id: string;
  readonly settings: UserSettings;
}

export interface NutryDatabaseOptions {
  readonly name?: string;
  /** Versions du schéma (les tests de migration en ajoutent une future). */
  readonly versions?: readonly DbVersion[];
  /** Implémentation IndexedDB (fake-indexeddb dans les tests). */
  readonly indexedDB?: DexieOptions['indexedDB'];
  readonly IDBKeyRange?: DexieOptions['IDBKeyRange'];
}

/** Base IndexedDB de Nutry : toutes les données de la personne, sur l'appareil. */
export class NutryDatabase extends Dexie {
  declare readonly profile: Table<ProfileRow, string>;
  declare readonly plans: Table<SavedPlan, IsoDate>;
  declare readonly ratings: Table<RatingRecord, string>;
  declare readonly progress: Table<ProgressEntry, IsoDate>;
  declare readonly quiz: Table<QuizRow, string>;
  declare readonly companion: Table<CompanionRow, string>;
  declare readonly shopping: Table<ShoppingRecord, IsoDate>;
  declare readonly settings: Table<SettingsRow, string>;
  declare readonly trainingProfile: Table<TrainingProfileRow, string>;
  declare readonly trainingPlans: Table<SavedTrainingPlan, IsoDate>;
  declare readonly sessionLogs: Table<SessionLog, string>;
  declare readonly painReports: Table<PainReport, string>;

  constructor(options: NutryDatabaseOptions = {}) {
    super(options.name ?? DB_NAME, {
      ...(options.indexedDB ? { indexedDB: options.indexedDB } : {}),
      ...(options.IDBKeyRange ? { IDBKeyRange: options.IDBKeyRange } : {}),
    });
    for (const { version, stores, upgrade } of options.versions ?? DB_VERSIONS) {
      const declared = this.version(version).stores(stores);
      if (upgrade) declared.upgrade(upgrade);
    }
  }

  /** Tables des données de la personne (export, import, effacement). */
  get userTables(): Table[] {
    return [
      this.profile,
      this.plans,
      this.ratings,
      this.progress,
      this.quiz,
      this.shopping,
      this.settings,
      this.companion,
      this.trainingProfile,
      this.trainingPlans,
      this.sessionLogs,
      this.painReports,
    ] as Table[];
  }
}
