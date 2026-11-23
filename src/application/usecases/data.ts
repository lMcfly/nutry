import { validateProfile } from '@domain/profile';
import type { IsoDateTime } from '@domain/shared';
import {
  DEFAULT_SETTINGS,
  backupFileName,
  isBackupReminderDue,
  latestInstant,
} from '@domain/userdata';
import type { BackupFile, UserDataSnapshot } from '@domain/userdata';
import type { AppPorts, SerialRunner } from './context';

/** Longueur minimale d'une phrase secrète d'export. */
export const PASSPHRASE_MIN_LENGTH = 8;
/** Taille maximale d'un fichier importé (en caractères) : bien au-delà d'années d'usage. */
export const IMPORT_MAX_LENGTH = 5_000_000;

export const JSON_MIME_TYPE = 'application/json';
export const ENCRYPTED_MIME_TYPE = 'application/octet-stream';

export type ExportResult =
  | {
      readonly status: 'exported';
      readonly fileName: string;
      readonly encrypted: boolean;
    }
  | {
      readonly status: 'passphrase-too-short';
      readonly minLength: number;
      readonly message: string;
    };

export interface ImportCounts {
  readonly profile: boolean;
  readonly plans: number;
  readonly ratings: number;
  readonly progress: number;
}

export type ImportFailure =
  'too-large' | 'invalid' | 'future-version' | 'passphrase-required' | 'wrong-passphrase';

export type ImportResult =
  | { readonly status: 'imported'; readonly counts: ImportCounts }
  | {
      readonly status: ImportFailure;
      /** Message prêt à afficher. */
      readonly message: string;
      /** Détails techniques (validation), pour un panneau « détails ». */
      readonly errors?: readonly string[];
    };

export const IMPORT_MESSAGES: Readonly<Record<ImportFailure, string>> = {
  'too-large': 'Ce fichier est bien trop volumineux pour être une sauvegarde Nutry.',
  invalid: 'Ce fichier n’est pas une sauvegarde Nutry valide. Tes données actuelles sont intactes.',
  'future-version':
    'Cette sauvegarde vient d’une version plus récente de Nutry : mets l’app à jour puis réessaie.',
  'passphrase-required': 'Cette sauvegarde est protégée : saisis sa phrase secrète.',
  'wrong-passphrase':
    'Impossible d’ouvrir la sauvegarde : la phrase secrète est incorrecte ou le fichier a été modifié.',
};

export interface BackupReminder {
  readonly due: boolean;
  readonly lastBackupAt?: IsoDateTime;
}

export interface DataUseCases {
  /** Exporte toutes les données (JSON clair, ou chiffré si une phrase secrète est donnée). */
  readonly exportData: (input?: { readonly passphrase?: string }) => Promise<ExportResult>;
  /**
   * Importe une sauvegarde (contenu texte du fichier choisi) en REMPLAÇANT toutes les
   * données, atomiquement. Rien n'est modifié en cas d'échec.
   */
  readonly importData: (input: {
    readonly content: string;
    readonly passphrase?: string;
  }) => Promise<ImportResult>;
  /** « Tout effacer » (à confirmer côté UI). */
  readonly wipeAllData: () => Promise<void>;
  /** Rappel doux de sauvegarde ; le montrer le note pour 30 jours. */
  readonly getBackupReminder: () => Promise<BackupReminder>;
}

const failure = (status: ImportFailure, errors?: readonly string[]): ImportResult => ({
  status,
  message: IMPORT_MESSAGES[status],
  ...(errors ? { errors } : {}),
});

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

export function createDataUseCases(ports: AppPorts, serial: SerialRunner): DataUseCases {
  return {
    exportData: (input = {}) =>
      serial(async () => {
        const { passphrase } = input;
        if (passphrase !== undefined && passphrase.length < PASSPHRASE_MIN_LENGTH) {
          return {
            status: 'passphrase-too-short',
            minLength: PASSPHRASE_MIN_LENGTH,
            message: `Choisis une phrase secrète d’au moins ${PASSPHRASE_MIN_LENGTH} caractères.`,
          };
        }
        const exportedAt = ports.clock.now().toISOString();
        const snapshot = await ports.userData.exportAll();
        const file: BackupFile = { app: 'nutry', exportedAt, ...snapshot };
        const json = JSON.stringify(file);
        const encrypted = passphrase !== undefined;
        const content = encrypted
          ? JSON.stringify(await ports.cipher.encrypt(json, passphrase))
          : JSON.stringify(file, null, 2);
        const fileName = backupFileName(ports.clock.today(), encrypted);
        await ports.fileSaver.save({
          name: fileName,
          mimeType: encrypted ? ENCRYPTED_MIME_TYPE : JSON_MIME_TYPE,
          content,
        });
        const settings = await ports.settings.get();
        await ports.settings.save({ ...settings, lastBackupAt: exportedAt });
        return { status: 'exported', fileName, encrypted };
      }),

    importData: ({ content, passphrase }) =>
      serial(async () => {
        if (content.length > IMPORT_MAX_LENGTH) return failure('too-large');
        let parsed = parseJson(content);
        if (!parsed.ok) return failure('invalid');

        const encrypted = await ports.backupValidator.parseEncrypted(parsed.value);
        if (encrypted) {
          if (passphrase === undefined || passphrase === '') return failure('passphrase-required');
          let plaintext: string;
          try {
            plaintext = await ports.cipher.decrypt(encrypted, passphrase);
          } catch {
            return failure('wrong-passphrase');
          }
          parsed = parseJson(plaintext);
          if (!parsed.ok) return failure('invalid');
        }

        const result = await ports.backupValidator.parseBackup(parsed.value);
        if (!result.ok) {
          return failure(
            result.reason === 'version-future' ? 'future-version' : 'invalid',
            result.errors,
          );
        }
        const { snapshot } = result;
        const profileIssues = snapshot.profile ? validateProfile(snapshot.profile) : [];
        if (profileIssues.length > 0) {
          return failure(
            'invalid',
            profileIssues.map((i) => `profile.${i.field}: ${i.message}`),
          );
        }

        const current = await ports.settings.get();
        const backupAt = latestInstant(snapshot.settings.lastBackupAt, result.exportedAt);
        // Réglage propre à cet appareil : on garde celui d'ici, jamais celui du fichier.
        const { persistenceGranted } = current;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { persistenceGranted: _otherDevice, ...importedSettings } = snapshot.settings;
        const toImport: UserDataSnapshot = {
          ...snapshot,
          settings: {
            ...importedSettings,
            ...(backupAt === undefined ? {} : { lastBackupAt: backupAt }),
            ...(persistenceGranted === undefined ? {} : { persistenceGranted }),
          },
        };
        await ports.userData.importAll(toImport);
        return {
          status: 'imported',
          counts: {
            profile: snapshot.profile !== undefined,
            plans: snapshot.plans.length,
            ratings: snapshot.ratings.length,
            progress: snapshot.progress.length,
          },
        };
      }),

    wipeAllData: () =>
      serial(async () => {
        // Réglage propre à l'appareil (le navigateur garde sa décision) : conservé, comme
        // à l'import, pour que « tout effacer » puis réimporter rende le même état.
        const { persistenceGranted } = await ports.settings.get();
        await ports.userData.clearAll();
        if (persistenceGranted !== undefined) {
          await ports.settings.save({ ...DEFAULT_SETTINGS, persistenceGranted });
        }
      }),

    getBackupReminder: () =>
      serial(async () => {
        const [profile, settings] = await Promise.all([ports.profiles.get(), ports.settings.get()]);
        const today = ports.clock.today();
        const due = isBackupReminderDue({ hasProfile: profile !== undefined, settings, today });
        if (due && settings.lastBackupReminderOn !== today) {
          await ports.settings.save({ ...settings, lastBackupReminderOn: today });
        }
        return {
          due,
          ...(settings.lastBackupAt === undefined ? {} : { lastBackupAt: settings.lastBackupAt }),
        };
      }),
  };
}
