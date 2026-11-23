import { createContext, useContext, type ReactNode } from 'react';
import type { Clock, Sharer } from '@application/ports';

/**
 * Dépendances injectées dans l'UI par la composition root (src/main.tsx).
 * La présentation ne connaît que des contrats de la couche application :
 * les cas d'usage (GenerateWeeklyPlan, AnswerQuiz…) s'ajouteront ici en phase 4.
 */
export interface AppDependencies {
  readonly clock: Clock;
  readonly sharer: Sharer;
}

const DependenciesContext = createContext<AppDependencies | null>(null);

interface DependenciesProviderProps {
  readonly value: AppDependencies;
  readonly children: ReactNode;
}

export function DependenciesProvider({ value, children }: DependenciesProviderProps) {
  return <DependenciesContext.Provider value={value}>{children}</DependenciesContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook couplé au provider
export function useDependencies(): AppDependencies {
  const dependencies = useContext(DependenciesContext);
  if (!dependencies) {
    throw new Error('useDependencies doit être utilisé sous <DependenciesProvider>.');
  }
  return dependencies;
}
