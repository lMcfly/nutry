import type { UserSettings } from './userdata.types';

export const DEFAULT_SETTINGS: UserSettings = { theme: 'system' };

/** Suivi du poids effectif : choix explicite, sinon la valeur par défaut du profil. */
export function isWeightTrackingEnabled(
  settings: Pick<UserSettings, 'weightTracking'>,
  enabledByDefault: boolean,
): boolean {
  return settings.weightTracking ?? enabledByDefault;
}
