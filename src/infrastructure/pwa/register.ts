/**
 * Point d'entrée chargé par index.html (fichier séparé : la CSP interdit les scripts
 * en ligne). Service worker : hors ligne et mise à jour douce (voir serviceWorker.ts).
 */
import { registerSW } from 'virtual:pwa-register';
import { startServiceWorker } from './serviceWorker';

startServiceWorker(registerSW, { hasServiceWorker: 'serviceWorker' in navigator });
