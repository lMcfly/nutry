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

/** Clé de session : la carte quiz ne s'affiche qu'une fois par session de navigateur. */
const QUIZ_SESSION_KEY = 'nutry.quiz.session';

/** Repli si sessionStorage est indisponible : une fois par chargement de page. */
let quizShownInMemory = false;

export function wasQuizShownThisSession(): boolean {
  try {
    return quizShownInMemory || sessionStorage.getItem(QUIZ_SESSION_KEY) === '1';
  } catch {
    return quizShownInMemory;
  }
}

export function markQuizShownThisSession(): void {
  quizShownInMemory = true;
  try {
    sessionStorage.setItem(QUIZ_SESSION_KEY, '1');
  } catch {
    // Navigation privée stricte : le repli en mémoire suffit.
  }
}

/** Pour les tests. */
export function resetQuizSession(): void {
  quizShownInMemory = false;
  try {
    sessionStorage.removeItem(QUIZ_SESSION_KEY);
  } catch {
    // ignoré
  }
}
