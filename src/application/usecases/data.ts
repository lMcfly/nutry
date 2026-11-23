import { normalizeGoal, validateProfile } from '@domain/profile';
import type { IsoDateTime } from '@domain/shared';
import {
  DEFAULT_SETTINGS,
  backupFileName,
  isBackupReminderDue,
  latestInstant,
} from '@domain/userdata';
import type { BackupFile, UserDataSnapshot } from '@domain/userdata';
import type { ResolvedPorts, SerialRunner } from './context';
import { DEVICE_KEYS } from './settings';

/** Longueur minimale d'une phrase secrète d'export. */
export const PASSPHRASE_MIN_LENGTH = 8;
/** Taille maximale d'un fichier importé (en caractères) : bien au-delà d'années d'usage. */
export const IMPORT_MAX_LENGTH = 5_000_000;
/**
 * Taille maximale du fichier choisi (en octets), vérifiée par l'UI AVANT de le lire : même
 * limite de 5 Mo (un caractère occupe au moins un octet, donc un fichier accepté ici
 * respecte aussi `IMPORT_MAX_LENGTH`).
 */
export const IMPORT_MAX_BYTES = IMPORT_MAX_LENGTH;

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
    }
  /** Le stockage ou le téléchargement a échoué : rien n'a changé. */
  | { readonly status: 'failed'; readonly message: string };

/** Résultat de « Tout effacer ». */
export type WipeResult =
  | { readonly status: 'wiped' }
  /** Échec du stockage : rien n'a été effacé. */
  | { readonly status: 'failed'; readonly message: string };

/** Messages doux en cas d'échec technique (stockage plein ou indisponible…). */
export const STORAGE_FAILURE_MESSAGES = {
  export:
    'La sauvegarde n’a pas pu être créée. Tes données sont intactes : réessaie dans un instant.',
  wipe: 'L’effacement n’a pas abouti : rien n’a été effacé. Réessaie dans un instant.',
} as const;

export interface ImportCounts {
  readonly profile: boolean;
  readonly plans: number;
  readonly ratings: number;
  readonly progress: number;
}

export type ImportFailure =
  | 'too-large'
  | 'invalid'
  | 'future-version'
  | 'passphrase-required'
  | 'wrong-passphrase'
  /** Échec du stockage de l'appareil (plein, indisponible…) : données intactes. */
  | 'failed';

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
  failed:
    'L’import n’a pas pu aller au bout (stockage de l’appareil indisponible ou plein). Tes données actuelles sont intactes.',
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
  /**
   * « Tout effacer » (à confirmer côté UI) : la base ET les valeurs gardées par Nutry dans
   * le stockage du navigateur (thème, drapeaux de session).
   */
  readonly wipeAllData: () => Promise<WipeResult>;
  /**
   * Rappel doux de sauvegarde ; le montrer le note pour 30 jours. Toujours `due: false`
   * une fois masqué dans la session (`dismissBackupReminder`).
   */
  readonly getBackupReminder: () => Promise<BackupReminder>;
  /** Masque le rappel jusqu'au prochain lancement de l'app (session de navigateur). */
  readonly dismissBackupReminder: () => void;
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

export function createDataUseCases(ports: ResolvedPorts, serial: SerialRunner): DataUseCases {
  /** Produit et remet le fichier de sauvegarde ; lève si le stockage échoue. */
  async function saveBackup(exportedAt: string, passphrase: string | undefined): Promise<string> {
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
    return fileName;
  }

  async function importBackup({
    content,
    passphrase,
  }: {
    readonly content: string;
    readonly passphrase?: string;
  }): Promise<ImportResult> {
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
      // Mêmes garde-fous qu'à l'enregistrement : pas d'objectif de perte pour un profil protégé.
      ...(snapshot.profile ? { profile: normalizeGoal(snapshot.profile) } : {}),
      settings: {
        ...importedSettings,
        ...(backupAt === undefined ? {} : { lastBackupAt: backupAt }),
        ...(persistenceGranted === undefined ? {} : { persistenceGranted }),
      },
    };
    await ports.userData.importAll(toImport);
    // Copie du thème sur l'appareil, alignée sur la sauvegarde restaurée.
    ports.device.set('local', DEVICE_KEYS.theme, toImport.settings.theme);
    return {
      status: 'imported',
      counts: {
        profile: snapshot.profile !== undefined,
        plans: snapshot.plans.length,
        ratings: snapshot.ratings.length,
        progress: snapshot.progress.length,
      },
    };
  }

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
        let fileName: string;
        try {
          fileName = await saveBackup(exportedAt, passphrase);
        } catch {
          return { status: 'failed', message: STORAGE_FAILURE_MESSAGES.export };
        }
        try {
          const settings = await ports.settings.get();
          await ports.settings.save({ ...settings, lastBackupAt: exportedAt });
        } catch {
          // Le fichier est remis : seule la date du rappel n'a pas pu être notée.
        }
        return { status: 'exported', fileName, encrypted: passphrase !== undefined };
      }),

    importData: (input) =>
      serial(async () => {
        try {
          return await importBackup(input);
        } catch {
          // Stockage ou chargement du validateur : la transaction n'a rien modifié.
          return failure('failed');
        }
      }),

    wipeAllData: () =>
      serial(async (): Promise<WipeResult> => {
        let persistenceGranted: boolean | undefined;
        try {
          // Réglage propre à l'appareil (le navigateur garde sa décision) : conservé, comme
          // à l'import, pour que « tout effacer » puis réimporter rende le même état.
          ({ persistenceGranted } = await ports.settings.get());
          await ports.userData.clearAll();
        } catch {
          return { status: 'failed', message: STORAGE_FAILURE_MESSAGES.wipe };
        }
        ports.device.clear();
        if (persistenceGranted !== undefined) {
          try {
            await ports.settings.save({ ...DEFAULT_SETTINGS, persistenceGranted });
          } catch {
            // Tout est effacé ; seul ce réglage d'appareil n'a pas pu être remis.
          }
        }
        return { status: 'wiped' };
      }),

    getBackupReminder: () =>
      serial(async () => {
        if (ports.device.get('session', DEVICE_KEYS.backupReminderDismissed) === '1') {
          return { due: false };
        }
        const [profile, settings] = await Promise.all([ports.profiles.get(), ports.settings.get()]);
        const today = ports.clock.today();
        const due = isBackupReminderDue({
          hasProfile: profile !== undefined,
          settings,
          today,
          localDay: (instant) => ports.clock.dayOf(new Date(instant)),
        });
        if (due && settings.lastBackupReminderOn !== today) {
          await ports.settings.save({ ...settings, lastBackupReminderOn: today });
        }
        return {
          due,
          ...(settings.lastBackupAt === undefined ? {} : { lastBackupAt: settings.lastBackupAt }),
        };
      }),

    dismissBackupReminder() {
      ports.device.set('session', DEVICE_KEYS.backupReminderDismissed, '1');
    },
  };
}
