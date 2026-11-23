import type { Theme, UserSettings } from '@domain/userdata';
import type { AppPorts, SerialRunner } from './context';

export interface SettingsUseCases {
  readonly getSettings: () => Promise<UserSettings>;
  readonly setTheme: (theme: Theme) => Promise<UserSettings>;
  /**
   * Demande au navigateur de ne pas évincer les données. À appeler APRÈS l'onboarding,
   * dans le gestionnaire du clic final (jamais au premier chargement).
   */
  readonly requestPersistentStorage: () => Promise<boolean>;
  /** Le stockage est-il déjà persistant ? (écran Confidentialité) */
  readonly isStoragePersisted: () => Promise<boolean>;
}

export function createSettingsUseCases(ports: AppPorts, serial: SerialRunner): SettingsUseCases {
  const patch = (change: Partial<UserSettings>) =>
    serial(async () => {
      const next = { ...(await ports.settings.get()), ...change };
      await ports.settings.save(next);
      return next;
    });

  return {
    getSettings: () => ports.settings.get(),

    setTheme: (theme) => patch({ theme }),

    async requestPersistentStorage() {
      const granted = await ports.persistence.request();
      await patch({ persistenceGranted: granted });
      return granted;
    },

    isStoragePersisted: () => ports.persistence.isPersisted(),
  };
}
