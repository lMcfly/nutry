import { createContext, useContext } from 'react';

export type ProfileStatus = 'loading' | 'none' | 'ready';

export interface AppState {
  /** `none` : pas encore de profil, l'onboarding s'affiche. */
  readonly profileStatus: ProfileStatus;
  readonly setProfileStatus: (status: ProfileStatus) => void;
}

export const AppStateContext = createContext<AppState | null>(null);

export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (!state) throw new Error('useAppState doit être utilisé sous <App>.');
  return state;
}
