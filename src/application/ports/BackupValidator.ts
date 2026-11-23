import type { IsoDateTime } from '@domain/shared';
import type { UserDataSnapshot } from '@domain/userdata';
import type { EncryptedPayload } from './Cipher';

export type BackupParseResult =
  | {
      readonly ok: true;
      readonly snapshot: UserDataSnapshot;
      /** Date d'export indiquée dans le fichier. */
      readonly exportedAt?: IsoDateTime;
    }
  | {
      readonly ok: false;
      /** `version-future` : sauvegarde d'une version plus récente de Nutry. */
      readonly reason: 'invalide' | 'version-future';
      /** Détails techniques (chemin : message), au plus quelques lignes. */
      readonly errors: readonly string[];
    };

/**
 * Validation stricte d'un fichier importé, donnée NON FIABLE : schéma (Zod, dans
 * l'infrastructure), bornes de taille, migration des formats antérieurs.
 */
export interface BackupValidator {
  /** Valide une sauvegarde en clair (objet issu de `JSON.parse`). */
  parseBackup(raw: unknown): Promise<BackupParseResult>;
  /** Reconnaît une sauvegarde chiffrée ; `undefined` si ce n'en est pas une valide. */
  parseEncrypted(raw: unknown): Promise<EncryptedPayload | undefined>;
}
