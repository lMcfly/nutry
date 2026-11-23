import { z } from 'zod';

/**
 * Zod configuré pour la CSP de l'app (index.html, `script-src 'self'` sans
 * `'unsafe-eval'`) : sans `jitless`, Zod 4 sonde `new Function('')` au premier objet
 * validé, ce qui déclenche une violation CSP (même interceptée). Tous les schémas de
 * l'infrastructure importent `z` d'ici.
 */
z.config({ jitless: true });

export { z };
