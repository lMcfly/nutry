# ADR 0003 — HashRouter et base Vite `/nutry/` pour GitHub Pages

- Statut : accepté
- Date : 2026-11-23

## Contexte

GitHub Pages sert des fichiers statiques sous `https://<compte>.github.io/nutry/`, sans réécriture
d'URL : un rechargement sur `/nutry/courses` renverrait une 404.

## Décision

- `base: '/nutry/'` dans `vite.config.ts` (nom du dépôt).
- `HashRouter` (react-router-dom 6) : URLs `…/nutry/#/semaine`. Aucune configuration serveur,
  aucun `404.html` de contournement, rechargement et liens profonds fiables, y compris dans la
  PWA installée et hors ligne (le service worker n'a qu'un `index.html` à servir).
- Routes : `/semaine` (défaut), `/courses`, `/profil`, `/progres`.

## Conséquences

- URLs moins élégantes (`#/`) : sans importance pour une PWA mobile.
- Si le dépôt est renommé, changer `base`, le `scope`/`start_url` du manifest et la config
  Playwright (`BASE_PATH`).
