# ADR 0014 — Photos de plats libres, hors précache

- Statut : accepté
- Date : 2026-11-24
- Complète : ADR 0013 (illustrations), ADR 0001 (frontières)

## Contexte

Les illustrations plates ne donnent pas toujours envie. On veut de vraies photos, libres de
droits, sans alourdir l'installation hors ligne ni ouvrir la CSP.

## Décision

- 86 photos WebP (800 × 600, moins de 80 Ko) de Wikimedia Commons dans `public/photos/`,
  servies par l'app elle-même : `img-src 'self'` suffit. Deux plats jugés trop faibles
  gardent l'illustration.
- Frontières : le port `PhotoCatalog` (application) est implémenté par `StaticPhotoCatalog`
  (infrastructure, `data/photoCredits.json`, base `import.meta.env.BASE_URL` fournie par la
  composition root). La présentation ne connaît aucun chemin : elle appelle `getPhotoUrls` et
  `listPhotoCredits`, et passe l'adresse à `DishImage`, qui retombe sur l'illustration si elle
  manque ou échoue.
- Textes de l'écran « Crédits photos » dans l'application (ADR 0010). La mention « modifiée :
  recadrée et compressée » répond à l'exigence CC BY-SA.
- PWA : photos exclues du précache (`globIgnores`), `runtimeCaching` CacheFirst
  `nutry-photos` (120 entrées, 60 jours). Hors ligne sans cache : illustration.
- Garde-fous : `photos.test.ts` vérifie fichiers présents, aucun orphelin, crédits complets en
  texte brut et licence libre (CC0, PD, CC BY*, CC BY-SA*) ; `docs/PHOTOS.md` est généré et
  vérifié à jour par un test.

## Conséquences

- Ajouter une photo : un WebP, une entrée de crédit, `npm run photos:doc`.
- La première visite d'une photo demande le réseau ; le reste de l'app reste 100 % hors ligne.
