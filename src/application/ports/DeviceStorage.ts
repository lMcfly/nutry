/**
 * `local` : garde la valeur d'un lancement à l'autre ; `session` : jusqu'à la fermeture
 * de l'onglet (ou du navigateur).
 */
export type DeviceStorageScope = 'local' | 'session';

/**
 * Petites valeurs propres à cet appareil, hors base de données : copie du thème (appliquée
 * avant que la base ne réponde, sans flash) et drapeaux de session (question du jour déjà
 * montrée, rappel de sauvegarde masqué). Synchrone et sans exception : si le stockage du
 * navigateur est indisponible, l'adaptateur se replie en mémoire.
 */
export interface DeviceStorage {
  get(scope: DeviceStorageScope, key: string): string | undefined;
  set(scope: DeviceStorageScope, key: string, value: string): void;
  /** Efface toutes les valeurs de Nutry, dans les deux portées (« Tout effacer »). */
  clear(): void;
}
