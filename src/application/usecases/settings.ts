import { THEMES } from '@domain/userdata';
import type { Theme, UserSettings } from '@domain/userdata';
import type { ResolvedPorts, SerialRunner } from './context';

/** Clés du stockage d'appareil (port `DeviceStorage`), hors base de données. */
export const DEVICE_KEYS = {
  /** Copie du thème (portée `local`) : appliquée avant que la base ne réponde. */
  theme: 'theme',
  /** Question du jour déjà montrée dans cette session (portée `session`). */
  quizShown: 'quiz.session',
  /** Rappel de sauvegarde masqué pour cette session (portée `session`). */
  backupReminderDismissed: 'backup-reminder.dismissed',
} as const;

const isTheme = (value: string | undefined): value is Theme =>
  (THEMES as readonly (string | undefined)[]).includes(value);

export interface SettingsUseCases {
  readonly getSettings: () => Promise<UserSettings>;
  /** Enregistre le thème et en garde une copie sur l'appareil (affichage sans flash). */
  readonly setTheme: (theme: Theme) => Promise<UserSettings>;
  /** Copie du thème gardée sur l'appareil, lisible tout de suite (synchrone). */
  readonly cachedTheme: () => Theme | undefined;
  /**
   * Vrai la première fois dans la session de navigateur, et le note : la question du
   * jour s'affiche une fois par session, pas à chaque changement d'onglet.
   */
  readonly claimDailyQuizForSession: () => boolean;
  /** Note la question du jour comme montrée (fin de l'onboarding : place au menu). */
  readonly markDailyQuizShown: () => void;
  /**
   * Demande au navigateur de ne pas évincer les données. À appeler APRÈS l'onboarding,
   * dans le gestionnaire du clic final (jamais au premier chargement).
   */
  readonly requestPersistentStorage: () => Promise<boolean>;
  /** Le stockage est-il déjà persistant ? (écran Confidentialité) */
  readonly isStoragePersisted: () => Promise<boolean>;
}

export function createSettingsUseCases(
  ports: ResolvedPorts,
  serial: SerialRunner,
): SettingsUseCases {
  const patch = (change: Partial<UserSettings>) =>
    serial(async () => {
      const next = { ...(await ports.settings.get()), ...change };
      await ports.settings.save(next);
      return next;
    });

  const markDailyQuizShown = () => {
    ports.device.set('session', DEVICE_KEYS.quizShown, '1');
  };

  return {
    getSettings: () => ports.settings.get(),

    setTheme: (theme) => {
      ports.device.set('local', DEVICE_KEYS.theme, theme);
      return patch({ theme });
    },

    cachedTheme() {
      const value = ports.device.get('local', DEVICE_KEYS.theme);
      return isTheme(value) ? value : undefined;
    },

    claimDailyQuizForSession() {
      if (ports.device.get('session', DEVICE_KEYS.quizShown) === '1') return false;
      markDailyQuizShown();
      return true;
    },

    markDailyQuizShown,

    async requestPersistentStorage() {
      const granted = await ports.persistence.request();
      await patch({ persistenceGranted: granted });
      return granted;
    },

    isStoragePersisted: () => ports.persistence.isPersisted(),
  };
}
