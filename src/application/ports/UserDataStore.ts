import type { UserDataSnapshot } from '@domain/userdata';

/** Toutes les données de la personne, d'un bloc (export, import, effacement). */
export interface UserDataStore {
  /** Lecture cohérente de toutes les données (une seule transaction). */
  exportAll(): Promise<UserDataSnapshot>;
  /**
   * Remplace atomiquement toutes les données par l'instantané : en cas d'échec,
   * rien n'est modifié. L'instantané doit avoir été validé au préalable.
   */
  importAll(snapshot: UserDataSnapshot): Promise<void>;
  /** Efface toutes les données de la personne (atomique). */
  clearAll(): Promise<void>;
}
