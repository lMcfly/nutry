/**
 * Composition root : seul endroit qui connaît toutes les couches.
 * On y instancie les adaptateurs d'infrastructure et on les injecte
 * dans la présentation via <DependenciesProvider>.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SystemClock } from '@infrastructure/clock/SystemClock';
import { NavigatorSharer } from '@infrastructure/share/NavigatorSharer';
import { App } from '@presentation/app/App';
import { DependenciesProvider, type AppDependencies } from '@presentation/app/dependencies';
import '@presentation/theme/tokens.css';
import '@presentation/theme/global.css';

const dependencies: AppDependencies = {
  clock: new SystemClock(),
  sharer: new NavigatorSharer(navigator),
};

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable dans index.html');

createRoot(container).render(
  <StrictMode>
    <DependenciesProvider value={dependencies}>
      <App />
    </DependenciesProvider>
  </StrictMode>,
);
