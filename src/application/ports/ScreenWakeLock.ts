/**
 * Maintient l'écran allumé pendant une séance (ADR 0015). Repli silencieux : si le
 * navigateur ne sait pas faire, `acquire` rend `false` sans lever d'erreur.
 */
export interface ScreenWakeLock {
  /** Demande à garder l'écran allumé ; vrai si c'est acquis. */
  acquire(): Promise<boolean>;
  /** Relâche le verrou (sans effet s'il n'y en a pas). */
  release(): Promise<void>;
}
