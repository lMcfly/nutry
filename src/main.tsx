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
import { SystemClock } from '@infrastructure/clock/SystemClock';
import { WebCryptoCipher } from '@infrastructure/crypto/WebCryptoCipher';
import { NutryDatabase } from '@infrastructure/db/NutryDatabase';
import {
  DexiePlanRepository,
  DexieProfileRepository,
  DexieProgressRepository,
  DexieQuizStateRepository,
  DexieRatingRepository,
  DexieSettingsRepository,
  DexieShoppingRepository,
  DexieUserDataStore,
} from '@infrastructure/db/repositories';
import {
  DownloadFileSaver,
  browserDownloadEnvironment,
} from '@infrastructure/files/DownloadFileSaver';
import { MathRandomSource } from '@infrastructure/random/MathRandomSource';
import { NavigatorSharer } from '@infrastructure/share/NavigatorSharer';
import { NavigatorStoragePersistence } from '@infrastructure/storage/NavigatorStoragePersistence';
import { App } from '@presentation/app/App';
import { DependenciesProvider } from '@presentation/app/dependencies';
import '@presentation/theme/tokens.css';
import '@presentation/theme/global.css';

const db = new NutryDatabase();

const ports: AppPorts = {
  clock: new SystemClock(),
  random: new MathRandomSource(),
  profiles: new DexieProfileRepository(db),
  plans: new DexiePlanRepository(db),
  ratings: new DexieRatingRepository(db),
  progress: new DexieProgressRepository(db),
  quizState: new DexieQuizStateRepository(db),
  shopping: new DexieShoppingRepository(db),
  settings: new DexieSettingsRepository(db),
  userData: new DexieUserDataStore(db),
  // Catalogues chargés à la demande (import dynamique) : rien de plus au premier rendu.
  recipes: new JsonRecipeRepository(),
  quizBank: new JsonQuizRepository(),
  sharer: new NavigatorSharer(navigator),
  cipher: new WebCryptoCipher(),
  backupValidator: new ZodBackupValidator(),
  // Le stockage persistant n'est demandé qu'après l'onboarding (cas d'usage dédié).
  persistence: new NavigatorStoragePersistence((navigator as { storage?: StorageManager }).storage),
  fileSaver: new DownloadFileSaver(browserDownloadEnvironment(document, URL)),
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
