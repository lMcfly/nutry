/**
 * Préparation du Sport pour les tests de la présentation : vrais cas d'usage, ports en mémoire,
 * catalogue d'exercices de test du domain (avec une recherche YouTube par fiche).
 */
import { FixedClock, createInMemoryPorts } from '@application/testing';
import type { InMemoryPorts } from '@application/testing';
import type { ExerciseMedia } from '@application/ports';
import { createUseCases } from '@application/usecases';
import type { TrainingWeekView, UseCases } from '@application/usecases';
import type { Profile } from '@domain/profile';
import { EXERCISE_FIXTURES } from '@domain/testing/exercises.fixtures';
import { FIXTURE_RECIPES } from '@domain/testing/fixtures';
import { defaultTrainingInput } from '@domain/training';
import type { TrainingProfileInput } from '@domain/training';
import { TEST_PROFILE } from './renderApp';

/** Lundi 23 novembre 2026, 10 h : jour de séance par défaut (lundi, mercredi, vendredi). */
export const SPORT_NOW = '2026-11-23T10:00:00.000Z';

export const EXERCISE_MEDIA: readonly ExerciseMedia[] = EXERCISE_FIXTURES.map((e) => ({
  exerciseId: e.id,
  images: [],
  videos: [],
  links: [
    {
      kind: 'youtube',
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(e.name)}`,
    },
  ],
  credit: {
    provider: 'nutry',
    authors: ['Nutry'],
    license: 'MIT',
    licenseUrl: 'https://opensource.org/licenses/MIT',
    modified: '',
  },
}));

export interface SportEnv {
  readonly ports: InMemoryPorts;
  readonly useCases: UseCases;
}

/** Profil Nourriture, et (sauf `training: false`) un profil sportif déjà enregistré et lu. */
export async function createSportEnv(
  options: {
    readonly profile?: Profile;
    readonly training?: Partial<TrainingProfileInput> | false;
    readonly acknowledged?: boolean;
  } = {},
): Promise<SportEnv> {
  const ports = createInMemoryPorts({
    recipes: FIXTURE_RECIPES,
    exercises: EXERCISE_FIXTURES,
    exerciseMedia: EXERCISE_MEDIA,
    clock: new FixedClock(SPORT_NOW),
  });
  ports.state.profile = options.profile ?? TEST_PROFILE;
  const useCases = createUseCases(ports);
  useCases.markQuizShown();
  if (options.training !== false) {
    await useCases.saveTrainingProfile({ ...defaultTrainingInput(), ...options.training });
    if (options.acknowledged !== false) await useCases.acknowledgeTrainingSafety();
  }
  return { ports, useCases };
}

export async function currentWeek(useCases: UseCases): Promise<TrainingWeekView> {
  const week = await useCases.getTrainingWeek();
  if (week.status !== 'ready') throw new Error(`semaine indisponible : ${week.status}`);
  return week;
}
