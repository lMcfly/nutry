import type { registerSW } from 'virtual:pwa-register';

/**
 * Mise à jour du service worker sans jamais recharger sous les doigts de la personne
 * (formulaire en cours, liste cochée…) :
 * - une version publiée pendant l'utilisation se télécharge puis ATTEND (`registerType:
 *   'prompt'`, aucun `skipWaiting` automatique) ; le navigateur l'active de lui-même dès
 *   que l'app est fermée (plus aucun onglet ni fenêtre contrôlé) ;
 * - si une version attend déjà AU LANCEMENT (l'app a été rechargée sans être fermée),
 *   elle est activée tout de suite : la page se recharge une fois, avant toute saisie.
 * Voir docs/DEPLOIEMENT.md, « Mettre à jour ».
 */
export function startServiceWorker(
  register: typeof registerSW,
  environment: { readonly hasServiceWorker: boolean },
): void {
  if (!environment.hasServiceWorker) return;
  const updateServiceWorker = register({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration?.waiting) void updateServiceWorker(true);
    },
  });
}
