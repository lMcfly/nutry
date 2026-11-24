# ADR 0014 — Photos de plats libres, hors précache

- Statut : accepté
- Date : 2026-11-24
- Modifié le 2026-11-24 : voir « Sources et Unsplash » ci-dessous
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

## Sources et Unsplash (révision)

Les photos Wikimedia, jugées peu appétissantes, sont remplacées par deux autres sources.

- **Foodiesfeed** (CC0) : 23 photos auto-hébergées dans `public/photos/`, comme avant.
- **Unsplash** : 61 photos, **hotlinkées** depuis `images.unsplash.com` (les guidelines de l'API
  Unsplash l'imposent : ni téléchargement ni auto-hébergement ; le déclenchement du « download »
  a été fait à la sélection). L'app n'utilise aucune clé d'API. L'adaptateur
  `StaticPhotoCatalog` construit `src` (800 px) et `srcset` (400 / 800 / 1200 px) :
  `rawUrl + &w=<W>&h=<W×3/4>&fit=crop&crop=focalpoint&fp-x&fp-y[&fp-z]&q=75&fm=webp&auto=format`.
  La présentation reçoit `src` / `srcset` via `getPhotoImages` et ne connaît aucune URL ;
  elle ajoute seulement `sizes`.
- **Wikimedia** : 4 plats sans meilleure photo gardent l'actuelle (tacos al pastor, galette
  complète, tajine d'agneau, endives au jambon).
- Modèle de crédits (`photoCredits.json`) : champ `provider` (`wikimedia`, `foodiesfeed`,
  `unsplash`) ; local = `file`, distant = `rawUrl` + `focal` + `authorUrl`. Licence
  `Unsplash` (https://unsplash.com/license). Attribution affichée : « Photo de _auteur_ sur
  Unsplash », avec les liens de l'auteur et d'Unsplash, paramètres `utm_source=nutry&utm_medium=referral`
  conservés. Textes dans `PHOTO_CREDITS_TEXTS` (ADR 0010).
- **CSP** : `img-src 'self' data: blob: https://images.unsplash.com` — seule ouverture. Pas de
  `connect-src` supplémentaire : le service worker n'est pas soumis à la CSP de la balise
  `<meta>` de la page, et la mise en cache d'images cross-origin se fait sans CORS (réponses
  opaques) ; vérifié par un test e2e (`csp.spec.ts`) qui charge une image Unsplash et contrôle
  le cache `nutry-photos-unsplash`. Le `referrerpolicy` reste celui par défaut
  (`strict-origin-when-cross-origin`) : Unsplash s'en sert pour ses statistiques.
- **PWA** : `runtimeCaching` CacheFirst `nutry-photos-unsplash` (`^https://images\.unsplash\.com/`,
  statuts 0 et 200, 150 entrées, 60 jours), en plus de `nutry-photos`. Les réponses opaques
  comptent chacune pour une taille forfaitaire (plusieurs Mo) dans le quota de stockage du
  navigateur : d'où la limite à 150 entrées. Correctif au passage : la règle `nutry-photos`
  utilisait une fonction faisant référence à `BASE`, absente du service worker généré (la règle
  levait une erreur et ne mettait rien en cache) ; c'est maintenant une expression régulière.
- **Vie privée** : charger une photo transmet l'adresse IP (et le referrer, l'origine de l'app)
  à Unsplash, comme pour tout site web ; aucune donnée personnelle ni de santé. Dit dans
  l'écran Confidentialité. Hors ligne ou en cas d'échec : illustration.
- **Tests** : `photos.test.ts` (fichier existant pour le local, `rawUrl` en
  `https://images.unsplash.com/` pour le distant, aucun orphelin, licences CC0 / PD / CC BY* /
  CC BY-SA* / Unsplash, liens `utm`), adaptateur (srcset, focal), page Crédits ;
  `privacy.qa.test.ts` n'admet que les URL Unsplash dans les sources. En e2e, `images.unsplash.com`
  est simulé (y compris pour le service worker) ; `CAPTURES=1` charge les vraies images.
- **Mise en page** : sur ordinateur et tablette en paysage, « Ta semaine » (Nutry, équilibre)
  devient une bande sous les cartes et la colonne des jours rétrécit : les cartes repas passent
  d'environ 320 à 450–520 px, photo 4:3 entière.
