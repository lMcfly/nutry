import type { Transaction } from 'dexie';
import { migrateQuizStateToSessions } from '../migrations/quizSessions';

/**
 * Schéma versionné de la base IndexedDB `nutry` (voir docs/adr/0009).
 *
 * AJOUTER UNE MIGRATION
 * 1. Ne jamais modifier une version déjà publiée : ajouter une entrée à la fin de
 *    `DB_VERSIONS` avec `version` = dernière + 1.
 * 2. `stores` décrit le schéma COMPLET de la nouvelle version (Dexie : clé primaire en
 *    premier, puis les index). `null` supprime une table.
 * 3. `upgrade` (facultatif) transforme les données existantes, dans la transaction de
 *    mise à niveau : si elle échoue, la base reste dans la version précédente.
 * 4. Ajouter un test dans `migrations.test.ts` (données v(n-1) → v(n)) et, si le format
 *    des données change, une migration de l'export (`backup/backupSchema.ts`) et
 *    `SNAPSHOT_SCHEMA_VERSION`.
 */
export interface DbVersion {
  readonly version: number;
  readonly stores: Readonly<Record<string, string | null>>;
  readonly upgrade?: (tx: Transaction) => Promise<void>;
}

export const DB_NAME = 'nutry';

/** Clé de la ligne unique des tables « singleton » (profil, quiz, réglages). */
export const SINGLETON_KEY = 'current';

export const DB_VERSIONS: readonly DbVersion[] = [
  {
    version: 1,
    stores: {
      profile: 'id',
      plans: 'weekStart',
      ratings: 'id, ratedAt',
      progress: 'date',
      quiz: 'id',
      shopping: 'weekStart',
      settings: 'id',
    },
  },
  {
    // Quiz : « question du jour » (`daily`) → une question à chaque ouverture (`current`).
    // Tables et index inchangés ; seule la ligne du quiz est transformée (ADR 0011).
    version: 2,
    stores: {
      profile: 'id',
      plans: 'weekStart',
      ratings: 'id, ratedAt',
      progress: 'date',
      quiz: 'id',
      shopping: 'weekStart',
      settings: 'id',
    },
    upgrade: async (tx) => {
      await tx
        .table<{ id: string; state: unknown }>('quiz')
        .toCollection()
        .modify((row) => {
          row.state = migrateQuizStateToSessions(row.state);
        });
    },
  },
];
