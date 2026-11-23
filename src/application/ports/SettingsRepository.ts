import type { UserSettings } from '@domain/userdata';

/** Réglages de l'app (thème, sauvegardes, rappel, stockage persistant…). */
export interface SettingsRepository {
  /** `DEFAULT_SETTINGS` si rien n'est encore enregistré. */
  get(): Promise<UserSettings>;
  save(settings: UserSettings): Promise<void>;
}
