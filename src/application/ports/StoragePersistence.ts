/** Stockage persistant du navigateur (évite l'éviction des données sous pression d'espace). */
export interface StoragePersistence {
  /** Demande la persistance ; `false` si refusée ou non prise en charge. */
  request(): Promise<boolean>;
  isPersisted(): Promise<boolean>;
}
