/**
 * Rendu de l'app pour les tests : vrais cas d'usage, ports en mémoire, recettes de
 * référence du domain. Aucun accès à l'infrastructure.
 */
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { createInMemoryPorts } from '@application/testing';
import type { InMemoryPorts } from '@application/testing';
import { createUseCases } from '@application/usecases';
import type { UseCases } from '@application/usecases';
import type { Profile } from '@domain/profile';
import type { QuizQuestion } from '@domain/quiz';
import type { Recipe } from '@domain/recipe';
import { BASE_PROFILE, FIXTURE_RECIPES } from '@domain/testing/fixtures';
import { App } from '../app/App';
import { AppStateContext } from '../app/appState';
import type { ProfileStatus } from '../app/appState';
import { markQuizShownThisSession, resetQuizSession } from '../app/appState';
import { DependenciesProvider } from '../app/dependencies';
import { ToastProvider } from '../components/Toast';

export const TEST_QUESTIONS: readonly QuizQuestion[] = [
  {
    id: 'q-paris',
    question: 'Quelle est la capitale de la France ?',
    choices: ['Lyon', 'Paris', 'Marseille', 'Lille'],
    correctIndex: 1,
    explanation: 'Paris est la capitale de la France depuis des siècles.',
    category: 'geographie',
    difficulty: 'facile',
  },
  {
    id: 'q-eau',
    question: 'À quelle température l’eau bout-elle au niveau de la mer ?',
    choices: ['50 °C', '80 °C', '100 °C', '120 °C'],
    correctIndex: 2,
    explanation: 'Sous une pression d’une atmosphère, l’eau bout à 100 °C.',
    category: 'sciences',
    difficulty: 'facile',
  },
];

export const TEST_PROFILE: Profile = { ...BASE_PROFILE, householdSize: 2 };

export interface SetupOptions {
  readonly profile?: Profile;
  readonly recipes?: readonly Recipe[];
  readonly questions?: readonly QuizQuestion[];
  /** Route initiale (hash), ex. '/courses'. */
  readonly route?: string;
  /** Laisser la carte quiz s'afficher (masquée par défaut). */
  readonly quiz?: boolean;
  readonly shareResult?: 'shared' | 'copied' | 'failed';
}

export interface Setup {
  readonly ports: InMemoryPorts;
  readonly useCases: UseCases;
  readonly user: ReturnType<typeof userEvent.setup>;
}

export function createTestUseCases(options: SetupOptions = {}): {
  ports: InMemoryPorts;
  useCases: UseCases;
} {
  const ports = createInMemoryPorts({
    recipes: options.recipes ?? FIXTURE_RECIPES,
    questions: options.questions ?? TEST_QUESTIONS,
    ...(options.shareResult ? { shareResult: options.shareResult } : {}),
  });
  if (options.profile) ports.state.profile = options.profile;
  return { ports, useCases: createUseCases(ports) };
}

/** L'app complète (HashRouter) avec ses vrais cas d'usage. */
export function renderApp(options: SetupOptions = {}): Setup {
  const { ports, useCases } = createTestUseCases(options);
  window.location.hash = options.route ?? '';
  resetQuizSession();
  if (!options.quiz) markQuizShownThisSession();
  const user = userEvent.setup();
  render(
    <DependenciesProvider value={useCases}>
      <App />
    </DependenciesProvider>,
  );
  return { ports, useCases, user };
}

/** Un écran isolé, sous MemoryRouter, avec les providers nécessaires. */
export function renderScreen(
  ui: ReactElement,
  options: SetupOptions & { readonly status?: ProfileStatus } = {},
): Setup & { setProfileStatus: (s: ProfileStatus) => void; statuses: ProfileStatus[] } {
  const { ports, useCases } = createTestUseCases({
    profile: TEST_PROFILE,
    ...options,
  });
  const statuses: ProfileStatus[] = [];
  const setProfileStatus = (s: ProfileStatus) => {
    statuses.push(s);
  };
  const user = userEvent.setup();
  render(
    <DependenciesProvider value={useCases}>
      <MemoryRouter initialEntries={[options.route ?? '/']}>
        <ToastProvider>
          <AppStateContext.Provider
            value={{ profileStatus: options.status ?? 'ready', setProfileStatus }}
          >
            {ui}
          </AppStateContext.Provider>
        </ToastProvider>
      </MemoryRouter>
    </DependenciesProvider>,
  );
  return { ports, useCases, user, setProfileStatus, statuses };
}
