# ADR 0009 — Persistance, migrations, sauvegarde chiffrée et rappel

- Statut : accepté
- Date : 2026-11-23

## Contexte

Toutes les données restent sur l'appareil (ADR 0002). Il faut donc : un schéma IndexedDB
qui évolue sans perte, une sauvegarde que la personne peut garder (et protéger), un import
qui ne fait jamais confiance au fichier, un « Tout effacer » fiable, et éviter que le
navigateur n'évince les données. Le cœur (domain, application) reste sans bibliothèque.

## Décision

### Modèle et ports

- Nouveau module `domain/userdata` : `UserDataSnapshot` (`schemaVersion`, profil, menus,
  avis, progrès, quiz, courses, réglages), `SavedPlan` (menu + `constraintsKey` +
  `generatedAt`), `RatingRecord` (avis + `id`, rattaché au repas), `ShoppingRecord` (état
  - `basisKey`), `UserSettings` (thème, choix de suivi du poids, dates de sauvegarde et de
    rappel, persistance accordée). Règles pures : `dietaryFingerprint`, `shoppingBasisKey`,
    `isBackupReminderDue`, `backupFileName`.
- Ports : `UserDataStore` (`exportAll`, `importAll` atomique, `clearAll`),
  `SettingsRepository`, `Cipher`, `StoragePersistence`, `FileSaver`, `BackupValidator`
  (validation des imports, implémentée en Zod dans l'infrastructure), `remove` sur les avis
  et les progrès, `QuizStateRepository` séparé de la banque de questions, `Clock.today()`
  et `Clock.dayOf(instant)` (jours **locaux**, pas UTC).

### Cas d'usage

- `createUseCases(ports)` fabrique un objet de fonctions (pas de framework DI). La
  présentation ne reçoit **que** cet objet (`DependenciesProvider`).
- Les cas d'usage qui écrivent passent par un **verrou sériel** commun : deux appels
  rapprochés (double clic, double effet du mode strict) ne s'entremêlent pas.
- **Menu sûr** : le menu enregistré porte l'empreinte des filtres durs du profil (régimes,
  allergies, aliments détestés, grossesse/allaitement). Au chargement, il est régénéré si
  l'empreinte a changé **ou** si un plat n'existe plus ou n'est plus compatible
  (`isRecipeCompatible` sur le catalogue courant : couvre une mise à jour du contenu ou un
  import). Les autres changements (poids, goûts, petit-déjeuner…) ne régénèrent pas :
  l'UI propose « Nouveau menu ».
- Liste de courses : si le menu, le foyer ou le facteur de portion changent, les coches
  des ingrédients sont remises à zéro (articles manuels conservés), signalé une fois
  (`reset`).
- Un avis par repas (`semaine:repas`) ; noter des restes note le plat d'origine.

### IndexedDB (Dexie)

- Base `nutry`, tables `profile`, `plans`, `ratings`, `progress`, `quiz`, `shopping`,
  `settings`. Le schéma est la liste `DB_VERSIONS` (`infrastructure/db/schema.ts`) ;
  version 2 : état du quiz par session (ADR 0011).
- **Ajouter une migration** : ajouter une entrée `{ version: n + 1, stores, upgrade }` à la
  fin (ne jamais modifier une version publiée), `stores` décrivant le schéma complet ;
  `upgrade` transforme les données dans la transaction de montée de version (échec →
  la base reste en version n). Un test (`migrations.test.ts`) simule une v2 et vérifie la
  conservation et la transformation des données, et le retour arrière en cas d'échec.
- `UserDataStore` : export, import (vidage puis écriture) et effacement chacun dans une
  seule transaction sur toutes les tables.

### Sauvegarde

- Fichier `nutry-sauvegarde-AAAA-MM-JJ.json` : `{ app: 'nutry', exportedAt, ...instantané }`.
- Avec une phrase secrète (8 caractères au moins) : fichier `.nutry` contenant
  `{ v: 1, alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iter, salt, iv, data }` (base64).
  AES-GCM 256 bits, clé dérivée par PBKDF2-SHA256 **600 000 itérations** (OWASP 2023 ;
  plancher accepté 310 000, plafond 5 000 000 contre un fichier piégé), sel de 16 octets
  et IV de 12 octets aléatoires à chaque export. GCM authentifie : une phrase fausse ou
  un fichier altéré donnent la même erreur claire. Aucune phrase n'est stockée.
- **Import = donnée non fiable** : taille ≤ 5 Mo, `JSON.parse` protégé, schéma Zod borné
  (longueurs, listes, vocabulaires fermés dérivés du domain, dates valides, doublons),
  clés inconnues ignorées ; instants en UTC (`Z`) uniquement ; rien de daté après
  `exportedAt` + 1 jour ; repas d'un menu à identifiants uniques et `date` = lundi +
  `dayIndex` ; puis `validateProfile` (domain, bornes de plausibilité : âge 10–120,
  taille 100–250 cm, poids 25–350 kg, tour de taille 40–200 cm, foyer 1–12, temps par
  repas 5–240 min). L'alignement des schémas Zod
  sur les types du domain est vérifié **à la compilation**. Les formats antérieurs passent
  par `SNAPSHOT_MIGRATIONS` (version n → n + 1) ; une version future est refusée avec un
  message dédié. Le remplacement est atomique ; en cas d'échec rien ne change. Le réglage
  propre à l'appareil (`persistenceGranted`) est conservé : jamais repris du fichier, et
  gardé par « Tout effacer » (export → effacer → import rend le même état).
- **Échecs de stockage** (quota, IndexedDB indisponible, validateur non chargé…) : jamais
  d'exception vers l'UI. `importData` rend `{ status: 'failed', message }` (données
  intactes : transaction unique), `exportData` aussi (rien n'est noté), `wipeAllData`
  rend `{ status: 'wiped' }` ou `{ status: 'failed', message }` (rien d'effacé). Les
  messages sont doux et prêts à afficher.
- Zod et les schémas sont chargés à la demande (import dynamique), comme les catalogues.

### Rappel de sauvegarde et stockage persistant

- Rappel doux si la dernière sauvegarde (ou, à défaut, la fin de l'onboarding) date de
  30 jours ou plus et qu'aucun rappel n'a été montré depuis 30 jours ; jamais sans profil.
  Montré, il reste visible le jour même (appel idempotent), puis se tait 30 jours.
  Tous les jours comparés sont **locaux** : `Clock.today()` et `Clock.dayOf(instant)`
  pour les instants enregistrés en UTC (jamais `slice(0, 10)` d'un instant).
- `requestPersistentStorage` (`navigator.storage.persist()`, repli `false`) est appelé
  par l'UI **à la fin de l'onboarding**, dans le gestionnaire du clic (jamais au premier
  chargement) ; la réponse est retenue dans les réglages.

## Conséquences

- Tout changement de format de données demande : une version Dexie, et si l'export
  change, `SNAPSHOT_SCHEMA_VERSION` + une migration d'export + le schéma Zod.
- Les tests d'infrastructure utilisent `fake-indexeddb` ; les tests de l'application et
  de la présentation utilisent les fakes en mémoire de `src/application/testing`.
- Une phrase secrète oubliée rend la sauvegarde chiffrée irrécupérable : l'UI doit le dire.
