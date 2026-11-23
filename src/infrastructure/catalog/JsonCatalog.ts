import type { QuizRepository, RecipeRepository } from '@application/ports';
import type { QuizQuestion } from '@domain/quiz';
import type { Recipe } from '@domain/recipe';

/** Charge et valide un contenu embarqué ; rejette avec un message clair s'il est invalide. */
export type Loader<T> = () => Promise<readonly T[]>;

/** Chargement unique et paresseux ; un échec n'est pas mis en cache (nouvel essai possible). */
function lazy<T>(load: Loader<T>): Loader<T> {
  let pending: Promise<readonly T[]> | undefined;
  return () => {
    pending ??= load().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
}

function describeIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): string {
  return issues
    .slice(0, 5)
    .map((i) => `${i.path.map(String).join('.')}: ${i.message}`)
    .join(' ; ');
}

/**
 * Recettes embarquées : le JSON et Zod sont chargés à la demande (import dynamique,
 * morceau séparé du bundle), puis validés une fois par session.
 */
export const loadEmbeddedRecipes: Loader<Recipe> = async () => {
  const [{ recipesFileSchema }, data] = await Promise.all([
    import('../data/schemas'),
    import('../data/recipes.json'),
  ]);
  const result = recipesFileSchema.safeParse(data.default);
  if (!result.success) {
    throw new Error(`Catalogue de recettes invalide : ${describeIssues(result.error.issues)}`);
  }
  return result.data;
};

export const loadEmbeddedQuiz: Loader<QuizQuestion> = async () => {
  const [{ quizFileSchema }, data] = await Promise.all([
    import('../data/schemas'),
    import('../data/quiz.json'),
  ]);
  const result = quizFileSchema.safeParse(data.default);
  if (!result.success) {
    throw new Error(`Banque de questions invalide : ${describeIssues(result.error.issues)}`);
  }
  return result.data;
};

export class JsonRecipeRepository implements RecipeRepository {
  private readonly load: Loader<Recipe>;
  private byId: Promise<ReadonlyMap<string, Recipe>> | undefined;

  constructor(load: Loader<Recipe> = loadEmbeddedRecipes) {
    this.load = lazy(load);
  }

  getAll(): Promise<readonly Recipe[]> {
    return this.load();
  }

  async getById(id: string): Promise<Recipe | undefined> {
    this.byId ??= this.load().then((recipes) => new Map(recipes.map((r) => [r.id, r])));
    try {
      return (await this.byId).get(id);
    } catch (error) {
      this.byId = undefined;
      throw error;
    }
  }
}

export class JsonQuizRepository implements QuizRepository {
  private readonly load: Loader<QuizQuestion>;

  constructor(load: Loader<QuizQuestion> = loadEmbeddedQuiz) {
    this.load = lazy(load);
  }

  getQuestions(): Promise<readonly QuizQuestion[]> {
    return this.load();
  }
}
