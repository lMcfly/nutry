import { createContext, useContext, type ReactNode } from 'react';
import type { UseCases } from '@application/usecases';

/**
 * Dépendances injectées dans l'UI par la composition root (src/main.tsx) : UNIQUEMENT
 * les cas d'usage. La présentation ne voit ni dépôt, ni horloge, ni adaptateur.
 */
export type AppDependencies = UseCases;

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
