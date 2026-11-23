import type { CompanionState } from '@domain/companion';

/** Stockage de l'état du compagnon Nutry (apparence, série, record). */
export interface CompanionRepository {
  /** État enregistré, ou l'état initial (`INITIAL_COMPANION_STATE`) s'il n'y en a pas. */
  get(): Promise<CompanionState>;
  save(state: CompanionState): Promise<void>;
}
