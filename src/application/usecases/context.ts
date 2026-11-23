import type {
  BackupValidator,
  Cipher,
  Clock,
  CompanionRepository,
  DeviceStorage,
  FileSaver,
  PlanRepository,
  ProfileRepository,
  ProgressRepository,
  QuizRepository,
  QuizStateRepository,
  RandomSource,
  RatingRepository,
  RecipeRepository,
  SettingsRepository,
  Sharer,
  ShoppingRepository,
  StoragePersistence,
  UserDataStore,
} from '../ports';
import { learnWeights } from '@domain/preferences';
import type { LearnedWeights } from '@domain/preferences';
import { assessEnergy, computeUserPortionFactor } from '@domain/profile';
import type { EnergyAssessment, Profile } from '@domain/profile';
import type { Recipe } from '@domain/recipe';
import type { RatingRecord } from '@domain/userdata';

/** Tous les ports dont les cas d'usage ont besoin, fournis par la composition root. */
export interface AppPorts {
  readonly clock: Clock;
  readonly random: RandomSource;
  readonly profiles: ProfileRepository;
  readonly plans: PlanRepository;
  readonly ratings: RatingRepository;
  readonly progress: ProgressRepository;
  readonly quizBank: QuizRepository;
  readonly quizState: QuizStateRepository;
  readonly companion: CompanionRepository;
  readonly shopping: ShoppingRepository;
  readonly settings: SettingsRepository;
  readonly recipes: RecipeRepository;
  readonly sharer: Sharer;
  readonly userData: UserDataStore;
  readonly cipher: Cipher;
  readonly backupValidator: BackupValidator;
  readonly persistence: StoragePersistence;
  readonly fileSaver: FileSaver;
  /**
   * Stockage d'appareil (thème mis en cache, drapeaux de session). Facultatif : sans lui,
   * repli en mémoire (valable jusqu'au rechargement de la page).
   */
  readonly device?: DeviceStorage;
}

/** Ports complétés par `createUseCases` (stockage d'appareil toujours présent). */
export interface ResolvedPorts extends AppPorts {
  readonly device: DeviceStorage;
}

/** Stockage d'appareil en mémoire : repli quand aucun adaptateur n'est fourni. */
export function memoryDeviceStorage(): DeviceStorage {
  const values = { local: new Map<string, string>(), session: new Map<string, string>() };
  return {
    get: (scope, key) => values[scope].get(key),
    set: (scope, key, value) => {
      values[scope].set(key, value);
    },
    clear: () => {
      values.local.clear();
      values.session.clear();
    },
  };
}

/** Résultat d'un cas d'usage qui demande un profil, avant l'onboarding. */
export interface NoProfile {
  readonly status: 'no-profile';
}
export const NO_PROFILE: NoProfile = { status: 'no-profile' };

/**
 * Exécution en série des cas d'usage qui écrivent : deux appels rapprochés (double clic,
 * double effet React en mode strict) ne s'entremêlent pas en lecture-modification-écriture.
 * Ne jamais appeler `run` depuis une tâche déjà en cours (interblocage).
 */
export type SerialRunner = <T>(task: () => Promise<T>) => Promise<T>;

export function createSerialRunner(): SerialRunner {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };
}

/** Ce qu'il faut pour planifier : profil, catalogue, avis et ce qu'on en déduit. */
export interface PlanningContext {
  readonly profile: Profile;
  readonly recipes: readonly Recipe[];
  readonly ratings: readonly RatingRecord[];
  readonly weights: LearnedWeights;
  readonly assessment: EnergyAssessment;
  /** `computeUserPortionFactor` : garde-fous des profils protégés inclus (ADR 0007). */
  readonly portionFactor: number;
}

export async function loadPlanningContext(ports: AppPorts): Promise<PlanningContext | undefined> {
  const [profile, recipes, ratings] = await Promise.all([
    ports.profiles.get(),
    ports.recipes.getAll(),
    ports.ratings.getAll(),
  ]);
  if (!profile) return undefined;
  const weights = learnWeights(ratings, recipes);
  const assessment = assessEnergy(profile);
  return {
    profile,
    recipes,
    ratings,
    weights,
    assessment,
    portionFactor: computeUserPortionFactor(assessment, weights.portionMultiplier),
  };
}

/** Index des recettes par identifiant. */
export function indexRecipes(recipes: readonly Recipe[]): ReadonlyMap<string, Recipe> {
  return new Map(recipes.map((r) => [r.id, r]));
}
