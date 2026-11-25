/**
 * Composition root : seul endroit qui connaît toutes les couches.
 * On y instancie les adaptateurs d'infrastructure, on fabrique les cas d'usage avec
 * leurs ports, et on n'injecte QUE les cas d'usage dans la présentation.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createUseCases } from '@application/usecases';
import type { AppPorts } from '@application/usecases';
import { ZodBackupValidator } from '@infrastructure/backup/ZodBackupValidator';
import { JsonQuizRepository, JsonRecipeRepository } from '@infrastructure/catalog/JsonCatalog';
import { StaticExerciseCatalog } from '@infrastructure/catalog/StaticExerciseCatalog';
import { StaticPhotoCatalog } from '@infrastructure/catalog/StaticPhotoCatalog';
import { SystemClock } from '@infrastructure/clock/SystemClock';
import { WebCryptoCipher } from '@infrastructure/crypto/WebCryptoCipher';
import {
  DownloadFileSaver,
  browserDownloadEnvironment,
} from '@infrastructure/files/DownloadFileSaver';
import { MathRandomSource } from '@infrastructure/random/MathRandomSource';
import { NavigatorWakeLock } from '@infrastructure/screen/NavigatorWakeLock';
import type { WakeLockApi } from '@infrastructure/screen/NavigatorWakeLock';
import { NavigatorSharer } from '@infrastructure/share/NavigatorSharer';
import { NavigatorStoragePersistence } from '@infrastructure/storage/NavigatorStoragePersistence';
import { WebDeviceStorage, browserDeviceStorages } from '@infrastructure/storage/WebDeviceStorage';
import { App } from '@presentation/app/App';
import { DependenciesProvider } from '@presentation/app/dependencies';
import '@presentation/theme/tokens.css';
import '@presentation/theme/global.css';

/**
 * Base IndexedDB (Dexie) chargée à la demande : elle sort du paquet initial et se
 * télécharge en parallèle du premier rendu. Chaque dépôt est un mandataire dont les
 * méthodes (toutes asynchrones, voir les ports) attendent le vrai dépôt.
 */
async function importRepositories() {
  const [{ NutryDatabase }, repositories] = await Promise.all([
    import('@infrastructure/db/NutryDatabase'),
    import('@infrastructure/db/repositories'),
  ]);
  return { ...repositories, db: new NutryDatabase() };
}
let repositoriesLoading: ReturnType<typeof importRepositories> | undefined;
const loadRepositories = () => (repositoriesLoading ??= importRepositories());

type Repositories = Awaited<ReturnType<typeof loadRepositories>>;

/** Mandataire asynchrone d'un port : chaque appel attend l'adaptateur réel. */
function lazyPort<T extends object>(create: (r: Repositories) => T): T {
  let instance: Promise<T> | undefined;
  const get = () => (instance ??= loadRepositories().then(create));
  return new Proxy({} as T, {
    get(_target, property) {
      // Pas un « thenable » : `await port` ne doit pas appeler `then`.
      if (property === 'then') return undefined;
      return (...args: unknown[]) =>
        get().then((port) => {
          const method = (port as Record<PropertyKey, unknown>)[property];
          if (typeof method !== 'function')
            throw new TypeError(`Méthode inconnue : ${String(property)}`);
          return (method as (...a: unknown[]) => unknown).apply(port, args);
        });
    },
  });
}

const ports: AppPorts = {
  clock: new SystemClock(),
  random: new MathRandomSource(),
  profiles: lazyPort((r) => new r.DexieProfileRepository(r.db)),
  plans: lazyPort((r) => new r.DexiePlanRepository(r.db)),
  ratings: lazyPort((r) => new r.DexieRatingRepository(r.db)),
  progress: lazyPort((r) => new r.DexieProgressRepository(r.db)),
  quizState: lazyPort((r) => new r.DexieQuizStateRepository(r.db)),
  companion: lazyPort((r) => new r.DexieCompanionRepository(r.db)),
  shopping: lazyPort((r) => new r.DexieShoppingRepository(r.db)),
  settings: lazyPort((r) => new r.DexieSettingsRepository(r.db)),
  training: lazyPort((r) => new r.DexieTrainingRepository(r.db)),
  sessionLogs: lazyPort((r) => new r.DexieSessionLogRepository(r.db)),
  painReports: lazyPort((r) => new r.DexiePainReportRepository(r.db)),
  userData: lazyPort((r) => new r.DexieUserDataStore(r.db)),
  // Catalogues chargés à la demande (import dynamique) : rien de plus au premier rendu.
  recipes: new JsonRecipeRepository(),
  quizBank: new JsonQuizRepository(),
  photos: new StaticPhotoCatalog(import.meta.env.BASE_URL),
  exercises: new StaticExerciseCatalog(import.meta.env.BASE_URL),
  sharer: new NavigatorSharer(navigator),
  cipher: new WebCryptoCipher(),
  backupValidator: new ZodBackupValidator(),
  // Le stockage persistant n'est demandé qu'après l'onboarding (cas d'usage dédié).
  persistence: new NavigatorStoragePersistence((navigator as { storage?: StorageManager }).storage),
  fileSaver: new DownloadFileSaver(browserDownloadEnvironment(document, URL)),
  device: new WebDeviceStorage(browserDeviceStorages(window)),
  // Écran maintenu allumé pendant une séance ; repli silencieux sans l'API.
  wakeLock: new NavigatorWakeLock((navigator as { wakeLock?: WakeLockApi }).wakeLock),
};

const useCases = createUseCases(ports);

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable dans index.html');

createRoot(container).render(
  <StrictMode>
    <DependenciesProvider value={useCases}>
      <App />
    </DependenciesProvider>
  </StrictMode>,
);
