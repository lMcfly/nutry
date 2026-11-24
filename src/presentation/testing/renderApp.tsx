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
import type { RecipePhoto } from '@application/ports';
import { DEVICE_KEYS, createUseCases } from '@application/usecases';
import type { ShareResult, UseCases } from '@application/usecases';
import type { Profile } from '@domain/profile';
import type { QuizQuestion, QuizState } from '@domain/quiz';
import type { Recipe } from '@domain/recipe';
import { BASE_PROFILE, FIXTURE_RECIPES } from '@domain/testing/fixtures';
import { App } from '../app/App';
import { AppStateContext } from '../app/appState';
import type { ProfileStatus } from '../app/appState';
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
  readonly profile?: Profile | undefined;
  readonly recipes?: readonly Recipe[];
  /** Photos de plats (crédits compris) ; aucune par défaut. */
  readonly photos?: readonly RecipePhoto[];
  readonly questions?: readonly QuizQuestion[];
  /** Route initiale (hash), ex. '/courses'. */
  readonly route?: string;
  /** Laisser la carte quiz s'afficher (masquée par défaut). */
  readonly quiz?: boolean;
  readonly shareResult?: ShareResult;
  readonly quizState?: QuizState;
  /** Session de quiz déjà ouverte (portée `session` de l'appareil) : même ouverture. */
  readonly quizSessionId?: string;
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
    ...(options.photos ? { photos: options.photos } : {}),
    questions: options.questions ?? TEST_QUESTIONS,
    ...(options.shareResult ? { shareResult: options.shareResult } : {}),
  });
  if (options.profile) ports.state.profile = options.profile;
  if (options.quizState) ports.state.quiz = options.quizState;
  if (options.quizSessionId) {
    ports.device.set('session', DEVICE_KEYS.quizSessionId, options.quizSessionId);
  }
  return { ports, useCases: createUseCases(ports) };
}

/** L'app complète (HashRouter) avec ses vrais cas d'usage. */
export function renderApp(options: SetupOptions = {}): Setup {
  const { ports, useCases } = createTestUseCases(options);
  window.location.hash = options.route ?? '';
  if (!options.quiz) useCases.markQuizShown();
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
  options: SetupOptions & {
    readonly status?: ProfileStatus;
    /** Ports et cas d'usage déjà préparés (menu généré, avis…). */
    readonly existing?: { readonly ports: InMemoryPorts; readonly useCases: UseCases };
  } = {},
): Setup & { setProfileStatus: (s: ProfileStatus) => void; statuses: ProfileStatus[] } {
  const { ports, useCases } =
    options.existing ?? createTestUseCases({ profile: TEST_PROFILE, ...options });
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
