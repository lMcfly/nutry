/**
 * Point d'entrée de la page de développement `mannequins.html` (planche et séquences).
 * Hors application : rien ici n'est chargé par index.html.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Planche } from '../features/training/figure/Planche';
import '../theme/tokens.css';
import '../theme/global.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Planche query={window.location.search} />
    </StrictMode>,
  );
}
