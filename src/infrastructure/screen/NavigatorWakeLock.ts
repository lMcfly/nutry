import type { ScreenWakeLock } from '@application/ports';

/** Sous-ensemble de l'API Screen Wake Lock dont on a besoin (absente de certains navigateurs). */
export interface WakeLockSentinelLike {
  release(): Promise<void>;
}
export interface WakeLockApi {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

/**
 * Garde l'écran allumé pendant une séance (`navigator.wakeLock`). Repli silencieux : API
 * absente, refus (économie d'énergie, page masquée) ou erreur → `acquire` rend `false`.
 * Le navigateur relâche le verrou quand la page est masquée : l'interface peut le redemander.
 */
export class NavigatorWakeLock implements ScreenWakeLock {
  private sentinel: WakeLockSentinelLike | undefined;

  constructor(private readonly api: WakeLockApi | undefined) {}

  async acquire(): Promise<boolean> {
    if (!this.api) return false;
    try {
      this.sentinel = await this.api.request('screen');
      return true;
    } catch {
      this.sentinel = undefined;
      return false;
    }
  }

  async release(): Promise<void> {
    const sentinel = this.sentinel;
    this.sentinel = undefined;
    if (!sentinel) return;
    try {
      await sentinel.release();
    } catch {
      // Déjà relâché par le navigateur : rien à faire.
    }
  }
}
