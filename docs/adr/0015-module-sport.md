# ADR 0015 — Module Sport : programme de la semaine, séance guidée, lien avec la Nourriture

- Statut : proposé (conception ; implémentation par phases ci-dessous)
- Date : 2026-11-25
- Complète : ADR 0001 (frontières), 0005 (Zod), 0006 (moteur de menu), 0007 (garde-fous
  santé), 0009 (persistance), 0010 (textes), 0012 (compagnon), 0013 (interface sans scroll),
  0014 (médias hors précache)

## Contexte

Nutry devient une app en deux parties : **Nourriture** (l'existant) et **Sport**. La personne
veut une semaine d'entraînement « normale » et cohérente (split adapté à la fréquence,
récupération par groupe musculaire, équilibre poussée/tirage, jambes, tronc, progression), une
séance guidée (images, séries, répétitions, repos, minuteur, « fait », tuto) et une cohérence
avec les repas, sans jamais céder sur les garde-fous santé (ADR 0007 : ils priment).

Contraintes inchangées : tout en local, sans compte, aucune requête réseau depuis `src/`,
CSP stricte, pas de scroll de page (ADR 0013), quatre onglets au plus, cœur pur et testé à
90 % (ADR 0001), textes en français dans le domain quand ils portent une règle (ADR 0010).

## Décision

### 1. Périmètre

**Dans la v1**

- Onboarding Sport facultatif (cinq écrans) et profil sportif modifiable.
- Programme hebdomadaire déterministe : split, jours, exercices, séries, répétitions, repos,
  échauffement et retour au calme, durée cible, rotation, double progression, semaine allégée.
- Séance guidée : un exercice par carte, images, séries à cocher, minuteur de repos, « fait »
  par série ou par exercice, « Remplacer », « Ça fait mal », fiche « Voir le tuto ».
- Garde-fous santé (grossesse, post-partum, condition de santé, 70 ans et plus, mineur,
  débutant, douleur) et mention « Nutry ne remplace pas un coach ni un médecin ».
- Lien Nourriture : jours de séance visibles dans la Semaine, petit bonus de score
  « récupération » les jours de séance, suggestion (jamais automatique) du niveau d'activité.
- Série et compagnon : une séance terminée compte comme geste ; accessoires sportifs.
- Sauvegarde, import, « Tout effacer » couvrent les nouvelles données.

**Hors v1** (évolutions possibles) : cardio programmé (course, vélo) avec allure, supersets et
circuits pour les séances de 20 min, décalage automatique d'une séance manquée, silhouette
musculaire en SVG, statistiques de charge, notifications (impossibles sans serveur push).

### 2. Sources et licences

- **wger** (wger.de) : fiches d'exercices (nom et consignes en français quand ils existent,
  muscles, matériel), images et quelques vidéos. Licences admises : CC0, CC BY 4.0,
  CC BY-SA 3.0 et 4.0 (pas d'ODbL pour les médias). Chaque fiche garde son **attribution** :
  auteurs, licence, page d'origine, et la mention de modification (« texte traduit et adapté ;
  images recadrées et compressées »). Les textes adaptés d'une fiche CC BY-SA sont une œuvre
  dérivée : `exercises.json` et les médias sont publiés sous **CC BY-SA 4.0** (une adaptation
  d'une œuvre 3.0 peut l'être sous 4.0) ; le code reste MIT. Écran « Crédits exercices » sur
  le modèle de « Crédits photos » (ADR 0014), et une ligne de crédit sous chaque fiche.
- **Vidéos libres** : wger, Mixkit, Coverr, Wikimedia Commons. **Auto-hébergées** en MP4 courts
  (≤ 60 s, ≤ 1,5 Mo, H.264, sans son, avec affiche WebP) dans `public/exercices/videos/`,
  chacune créditée (auteur, licence, page d'origine). Mixkit et Coverr ont leur propre licence
  libre (sans attribution exigée) : on crédite quand même. Lues par une balise `<video>` de
  l'app (`media-src 'self'`, à écrire explicitement dans la CSP ; il est déjà couvert par
  `default-src 'self'`).
- **Seul lien sortant** : une **recherche YouTube** sur le nom de l'exercice
  (`https://www.youtube.com/results?search_query=…`), ouverte dans un nouvel onglet
  (`rel="noopener noreferrer"`), libellée « Chercher une vidéo sur YouTube (site externe) ».
  Ni iframe, ni lecture intégrée, ni vidéo YouTube précise (lien qui casse, contenu non
  vérifié). La CSP ne change pas pour ce lien (une navigation n'est pas une ressource).
- Historique : une autre base propriétaire d'exercices a été source envisagée puis écartée
  (contenu non libre, accès automatisé refusé) ; rien n'en est repris, aucun lien n'y mène.
- **Images** : WebP 480 px de large (≤ 40 Ko) auto-hébergées dans `public/exercices/`, comme
  les photos de plats : exclues du précache, `runtimeCaching` CacheFirst `nutry-exercices`
  (images et vidéos, 300 entrées, 60 jours). Hors ligne sans cache : pictogramme du schéma de
  mouvement à la place de l'image, consignes toujours disponibles (elles sont dans le JSON).
- **Curation** : on ne garde que ~150 à 200 exercices utiles (pas les ~800 de wger), choisis
  pour couvrir chaque schéma × cadre × niveau (voir les critères de la phase 2). Les mouvements
  d'échauffement, de mobilité et d'équilibre absents de wger sont rédigés pour Nutry
  (`provider: 'nutry'`, mêmes règles de format).

### 3. Modèle de domaine (`src/domain/training/`)

Types figés dans `training.types.ts`, vocabulaires et barèmes dans `training.constants.ts`
(tableaux `as const` dont dérivent les schémas Zod), gabarits dans `templates.ts`, textes de
santé dans `safety.constants.ts`, signatures à implémenter dans `training.contracts.ts`.

| Concept             | Type                                                                      | Rôle                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Exercice            | `Exercise`                                                                | schéma de mouvement, muscles principaux/secondaires, matériel, niveau, mesure (répétitions ou durée), étiquettes, consignes  |
| Groupe musculaire   | `MuscleGroup` (11)                                                        | pectoraux, dos, épaules, biceps, triceps, abdominaux, lombaires, fessiers, quadriceps, ischio-jambiers, mollets              |
| Schéma de mouvement | `MovementPattern` (13)                                                    | poussée/tirage horizontal·vertical, genou, hanche, gainage, flexion/extension du coude, mollets, cardio, mobilité, équilibre |
| Matériel            | `Equipment` (11) + `EquipmentSetting`                                     | maison (poids du corps), maison équipée (haltères, élastiques), salle ; le tapis est toujours supposé disponible             |
| Niveau              | `TrainingLevel`                                                           | débutant, intermédiaire, confirmé (distinct du `Level` des recettes)                                                         |
| Objectif            | `TrainingGoal`                                                            | forme, force, muscle, endurance → fourchette de répétitions et repos (`REP_SCHEMES`)                                         |
| Profil sportif      | `TrainingProfile`                                                         | fréquence, jours, cadre, matériel, niveau, objectif, durée, étape de grossesse, début                                        |
| Gabarit de séance   | `SessionTemplate`, `SessionBlock`, `SessionSlot`                          | blocs de 1 ou 2 créneaux (schéma + rôle principal/secondaire/accessoire)                                                     |
| Programme           | `WeeklyTrainingPlan`, `PlannedSession`, `PlannedExercise`, `Prescription` | la semaine : split, cycle, séances, exercices prescrits                                                                      |
| Journal             | `SessionLog`, `ExerciseLog`, `SetLog`                                     | ce qui a été fait, série par série (répétitions, secondes, charge)                                                           |
| Douleur             | `PainReport`                                                              | « Ça fait mal » : exercice écarté 28 jours, muscles concernés                                                                |
| Sécurité            | `TrainingSafety`                                                          | étiquettes exclues/déconseillées, intensité, progression de charge, plafond de séances, messages                             |

`WeeklyTrainingPlan` porte ce nom (et non `WeeklyPlan`) pour ne pas croiser le menu des repas.
Le domain ne voit ni chemin d'image, ni vidéo, ni licence : ils passent par le port
`ExerciseCatalog` (`application/ports/ExerciseCatalog.ts`), dont `getMedia` rend images,
vidéos, lien de recherche YouTube et crédit.

### 4. Planification déterministe

Fonction pure `planTrainingWeek(input)` : à entrée égale, sortie égale. **Aucun aléa** : la
rotation dépend des numéros de bloc et de semaine. Ordre des étapes :

1. **Garde-fous** : `assessTrainingSafety(profile, training)` (section 5).
2. **Split** : `chooseSplit(jours, plafond)` (implémenté et testé dans `templates.ts`).

   | Séances de renforcement | Split préféré (alternative)                                |
   | ----------------------- | ---------------------------------------------------------- |
   | 1                       | corps entier A                                             |
   | 2                       | corps entier A, B (sinon haut A, bas A)                    |
   | 3                       | corps entier A, B, C (sinon haut A, bas A, corps entier C) |
   | 4                       | haut A, bas A, haut B, bas B                               |
   | 5                       | poussée, tirage, jambes, haut B, bas B                     |
   | 6                       | poussée, tirage, jambes × 2                                |

   Jours par défaut : 1 → samedi ; 2 → lun, jeu ; 3 → lun, mer, ven ; 4 → lun, mar, jeu, ven ;
   5 → lun, mar, mer, ven, sam ; 6 → lun à sam. La personne peut les changer.
   Recherche : pour chaque split candidat, chaque sous-ensemble de jours (ordre
   lexicographique) et chaque rotation, la première combinaison **sans conflit** l'emporte.
   Plafond de renforcement : débutant 4, 70 ans et plus ou condition de santé 3 ; les jours en
   trop deviennent des séances **douces** (mobilité, équilibre, cardio léger ; avis
   `seances-plafonnees`). Si aucune combinaison ne respecte la récupération (ex. trois jours
   consécutifs), les séances en conflit deviennent douces (avis `jours-rapproches`).

3. **Règle des 48 h** : deux séances à moins de `MIN_RECOVERY_DAYS` = 2 jours d'écart (la
   semaine suivante comprise : dimanche → lundi = 1 jour) ne sollicitent jamais fortement un
   même groupe. « Fortement » = muscle principal permis par un schéma non exempté ; gainage,
   cardio, mobilité et équilibre sont exemptés. Comme un exercice n'est éligible à un créneau
   que si ses muscles principaux sont dans `PATTERN_PRIMARY_GROUPS[schéma]`, la règle se
   vérifie au niveau des gabarits (`templateHeavyGroups`) : un test exhaustif couvre les 126
   ensembles de 1 à 6 jours × 3 plafonds.
4. **Équilibres** (en séries par semaine, testés pour chaque split, chaque niveau et chaque
   niveau de raccourcissement) : tirage / poussée entre 1 et 2 ; genou / hanche entre 0,67 et
   1,5. Ils tiennent par construction : chaque bloc associe poussée et tirage, ou genou et
   hanche, et on abandonne des blocs entiers.
5. **Volume par groupe** (muscle principal = 1 série, secondaire = 0,5) : plafond toujours
   respecté (`WEEKLY_VOLUME.max` : 12 / 18 / 22 séries selon le niveau), cible minimale
   (4 / 8 / 10) vérifiée dès trois séances de 45 min. Séries par créneau : `SETS_BY_ROLE`.
6. **Cycle** (`computeCycle`) : semaines actives = semaines avec au moins une séance
   terminée. Bloc de 6 (débutant), 5 (intermédiaire) ou 4 (confirmé) semaines, la dernière
   **allégée** : séries × 0,5 (arrondi au-dessus), charges × 0,9, aucune progression. Après
   deux semaines sans séance, la semaine de **reprise** est allégée aussi.
7. **Sélection** par créneau : filtre dur (`isExerciseEligible` : schéma, matériel disponible,
   niveau de l'exercice ≤ niveau, aucune étiquette exclue, pas écarté pour douleur, muscles
   principaux permis), puis classement (`rankExercises` : +3 matériel préféré du cadre pour un
   créneau principal, +1 niveau égal, −2 par étiquette déconseillée, −5 déjà utilisé dans la
   semaine ; égalité : `id`).
8. **Rotation** : principal et secondaire restent **les mêmes sur tout un bloc** (sinon la
   progression n'a pas de sens) et changent au bloc suivant (`rang = numéro de bloc mod
min(n, 3)`) ; les accessoires tournent chaque semaine (`numéro de semaine mod min(n, 3)`).
   Créneau sans candidat : retiré, avis `catalogue-insuffisant`.
9. **Prescription** (`prescribe`) — double progression :
   - fourchette de `REP_SCHEMES[objectif]` (force 6–8, muscle 8–12, forme 10–15, endurance
     15–20 ; plancher 8 pour un débutant, 10 pour un profil protégé ; accessoires +2) ;
     exercices en durée : `HOLD_SECONDS` par niveau ;
   - première fois : « Trouve ta charge » (garde 2 ou 3 répétitions en réserve) ;
   - toutes les séries à la borne haute → charge + incrément (`LOAD_INCREMENT_KG` : haltères
     1 kg, barre 2,5 kg, kettlebell 4 kg) et retour à la borne basse ; au poids du corps ou à
     l'élastique : borne haute + 2 jusqu'à 20, puis « Passe à la variante plus difficile »
     (`harderId`) ;
   - deux séances de suite sous la borne basse → charge × 0,9 ;
   - sinon « Ajoute une répétition » ; `loadProgression: false` → « Maintiens ».
10. **Échauffement** (3 min pour 20 min, 5 min sinon) : cardio doux (sans `impact` si exclu)
    puis mobilité des groupes du jour ; série d'approche légère avant le premier exercice
    chargé. **Retour au calme** (2 à 4 min) : mobilité et respiration.
11. **Durée cible** (20, 30, 45 ou 60 min, échauffement compris) : estimation = transitions
    (60 s) + séries × (répétitions moyennes × 4 s, ou secondes tenues, × 2 si unilatéral) +
    repos. Tant que l'estimation dépasse la cible de plus de 10 % : retirer les accessoires,
    ramener les séries à 2, abandonner les derniers blocs jusqu'à `minBlocks`.
12. **Programme enregistré** : comme le menu (ADR 0009), il porte une empreinte des contraintes
    (`trainingConstraintsKey` : jours, matériel, niveau, objectif, durée, étape de grossesse,
    champs santé du profil). Il est régénéré si l'empreinte change ou si un exercice n'existe
    plus ou n'est plus éligible ; sinon il reste stable toute la semaine.

### 5. Garde-fous santé

Ils sont des **filtres durs**, appliqués par toute fonction qui propose un exercice (programme,
remplacement, douleur), comme `isRecipeCompatible` pour les repas. Textes dans
`TRAINING_SAFETY_MESSAGES` (tutoiement, aucune calorie, testé).

| Situation                                        | Exclu (`SAFETY_EXCLUDED_TAGS`)                                                        | Autres règles                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Grossesse, 1er trimestre                         | impact, haute intensité, à plat ventre, enroulement du buste, instable, charge axiale | intensité modérée (« tu dois pouvoir parler »), 3 répétitions en réserve, pas de progression de charge                    |
| Grossesse après le 1er trimestre **ou inconnue** | idem + **allongée sur le dos**                                                        | idem ; message « Demande l'avis de ta sage-femme ou de ton médecin » à lire avant la première séance                      |
| Post-partum / allaitement                        | impact, haute intensité, enroulement du buste                                         | intensité modérée, pas de progression de charge ; message sage-femme et rééducation du périnée                            |
| Condition de santé (`healthCondition`)           | impact, haute intensité                                                               | 3 séances de renforcement au plus, intensité modérée, pas de progression de charge ; « parles-en à ton médecin »          |
| 70 ans et plus                                   | impact (pas de pliométrie), haute intensité, instable, charge axiale                  | 3 séances au plus, bloc **équilibre et mobilité** dans chaque séance complète ; « au sol » et « à plat ventre » pénalisés |
| Moins de 18 ans                                  | charge axiale                                                                         | 10 répétitions au moins, technique d'abord ; « avec un adulte ou un encadrant »                                           |
| Débutant                                         | —                                                                                     | 4 séances de renforcement au plus, 8 répétitions au moins ; charge axiale et instable pénalisées                          |

- L'étape de grossesse (`pregnancyStage`) n'est demandée que si `Profile.pregnantOrBreastfeeding`
  est vrai ; sans réponse, la règle la plus protectrice s'applique.
- Les règles se cumulent (exclusions réunies, plafond le plus bas, plancher le plus haut).
- **« Ça fait mal »** (bouton sur chaque carte d'exercice) : la série en cours s'arrête,
  messages `douleur` (arrête, gêne ≠ douleur vive ou articulaire, consulte si ça dure) et
  `urgence` (douleur dans la poitrine, malaise : appelle le 15 ou le 112) ; l'exercice est
  écarté 28 jours et remplacé (variante `easierId`, puis sans charge, puis niveau plus bas, sans
  les étiquettes de l'exercice douloureux). Deux signalements sur un même groupe en 14 jours :
  message `douleur-repetee` (repos de la zone, avis médical).
- Mention permanente sur l'écran Sport et dans chaque fiche : « Nutry ne remplace pas un coach
  ni un médecin. » Les seuils restent à faire valider par un professionnel, comme ceux de
  l'ADR 0007.

### 6. Lien avec la Nourriture, la série et Nutry

- **Jours d'entraînement** : `trainingDaysOf(plan)` donne les jours de séance (hors séances
  douces) ; la Semaine les marque d'un petit pictogramme dans le bandeau des jours, sans
  ajouter de hauteur.
- **Ajustements prudents** (les garde-fous de l'ADR 0007 priment) :
  - **aucune** modification automatique des portions ni des calories, **aucune** « dépense »
    affichée, aucune idée de nourriture « méritée » ou de séance pour « compenser » ;
  - un composant de score `sport` (+1) au déjeuner et au dîner d'un jour de séance pour une
    recette avec protéine principale et au moins un quart de féculents ; « Pourquoi ce plat ? »
    dit « Jour de séance : de quoi bien récupérer ». C'est une préférence, jamais un filtre
    (mise à jour de l'ADR 0006 à la phase 5) ;
  - **suggestion** de niveau d'activité : si le volume prévu (fréquence × durée) dépasse
    `ACTIVITY_FLOOR_BY_WEEKLY_MINUTES` (60 min → léger, 150 → modéré, 300 → actif) et que le
    niveau déclaré est plus bas, une carte propose de le relever **d'un cran**, sur
    confirmation, refusable (réglage `activitySuggestionDismissedOn`). Le déficit de « perdre
    en douceur » reste plafonné à 15 % ; un profil protégé n'a toujours aucun déficit et un
    facteur de portion ≥ 1 ;
  - rappel d'hydratation dans l'écran de séance.
- **Série** : une séance **terminée** (`isSessionComplete`) compte comme le geste du jour
  (`recordCompanionActivity` appelé dans `completeSession`, sous le verrou sériel, au mieux
  comme pour les autres gestes : un échec du compagnon n'annule pas la séance). Cocher une
  série seule ne compte pas.
- **Nutry** : accessoires sportifs débloqués par le **nombre cumulé de séances terminées**
  (dérivé des journaux, donc rien ne se reperd) : bandeau (tête) à 1 séance, serviette (cou) à
  5, casquette (tête) à 10, médaille (cou) à 20. `unlockAt` devient
  `{ kind: 'serie', days } | { kind: 'seances', count }` (migration du catalogue et de son
  test de concordance ; le schéma de l'apparence suit le tuple des identifiants).

### 7. Navigation (sans scroll de page, 4 onglets au plus)

**Décision : un onglet « Sport »**, entre Semaine et Courses : **Semaine · Sport · Courses ·
Moi**. Alternatives écartées :

- double planning Repas/Sport dans la Semaine : l'écran est déjà plein au téléphone (bandeau
  des jours, onglets repas, grande carte) ; deux niveaux d'onglets superposés et une carte
  plus petite ;
- interrupteur « Repas | Sport » en tête de Semaine : fonction cachée, et conflit avec les
  onglets repas existants.

Écrans :

- **Sport** (`/sport`) : même bandeau des 7 jours (jours de séance marqués) ; une grande carte
  pour le jour choisi : séance prévue (titre, « 35 min · 5 exercices », groupes du jour, trois
  vignettes, bouton « Commencer »), séance faite (résumé), ou jour de repos (suggestion douce,
  Nutry). En bas : « 2 séances sur 3 » et « Semaine 3 sur 5 » ou « Semaine allégée ». Menu
  « ⋯ » : mon programme, matériel et jours, crédits exercices.
- **Séance** (`/sport/seance/:weekStart/:sessionId`, mode concentré sans barre d'onglets) :
  échauffement, puis une carte par exercice (glissement et boutons ‹ ›, comme les repas) :
  image en `fill`, nom, « 3 × 8–12 · repos 1 min 30 », pastilles de séries à cocher (répétitions
  et charge modifiables d'un toucher), « Fait » pour tout l'exercice, « Voir le tuto »,
  « Remplacer », « Ça fait mal ». Cocher une série lance le **minuteur de repos** (bande en bas :
  temps restant, +15 s, Passer ; calculé depuis l'instant de fin, donc juste après une mise en
  veille ; vibration et annonce `aria-live` à la fin seulement). Écran maintenu allumé pendant la
  séance (port `ScreenWakeLock`, repli silencieux). Fin : ressenti (facile, correct, difficile)
  et célébration de Nutry.
- **Tuto** (feuille plein écran) : images (début et fin du mouvement), vidéo auto-hébergée si
  elle existe, consignes, conseils, muscles ciblés, matériel, crédit, lien « Chercher une vidéo
  sur YouTube (site externe) », mention de prudence. Les listes longues défilent dans leur
  `ScrollArea`.
- Tablette et ordinateur : Sport en deux colonnes (jours / séance du jour) ; séance avec image
  à gauche et séries à droite. `sans-scroll.spec.ts` couvre les nouveaux écrans.

### 8. Persistance

- **Dexie version 4** (`DB_VERSIONS`, ajout en fin de liste) : nouvelles tables
  `trainingProfile: 'id'` (singleton), `trainingPlans: 'weekStart'`,
  `sessionLogs: 'id, weekStart, date'`, `painReports: 'id, date, exerciseId'`. Pas d'`upgrade`
  (tables nouvelles, absence = Sport non activé). Test dans `migrations.test.ts`.
- **`SNAPSHOT_SCHEMA_VERSION` = 4** : clés `training?` (`TrainingProfile`), `trainingPlans`,
  `sessionLogs`, `painReports` ; `ScoreComponentKey` gagne `sport` ; `UserSettings` gagne
  `activitySuggestionDismissedOn?`. Migration 3 → 4 : listes vides, pas de profil sportif.
- **Schémas Zod de sauvegarde** alignés à la compilation (`Same<…>` comme aujourd'hui), bornés :
  1 500 programmes, 3 000 journaux, 60 exercices par séance, 20 séries par exercice,
  répétitions 0–200, secondes 0–3 600, charge 0–500 kg, 500 signalements ; dates et cohérence
  (`id` = `weekStart:sessionId`, `weekStart` un lundi, `date` dans la semaine ou après, rien
  après `exportedAt` + 1 jour, `days` triés, uniques et de longueur `frequency`).
  `UserDataStore` (export, import atomique, `clearAll`) couvre les quatre tables.
- **Catalogue** : `src/infrastructure/data/exercises.json`, format `exerciseCatalogFileSchema`
  (`exerciseSchemas.ts`, testé) : en-tête de provenance, puis pour chaque exercice les champs
  de `Exercise` + `images` + `videos` + `youtubeSearchUrl?` + `credit`. Contrôles : nature
  cohérente avec le schéma, muscles principaux permis, séries en durée seulement pour gainage,
  cardio, mobilité, équilibre, variantes existantes et du même schéma, médias sans doublon,
  licences et hôtes des sources vérifiés, lien YouTube limité à une recherche. Chargé à la
  demande (import dynamique), validé par `npm run validate-data`.

### 9. Onboarding Sport

Proposé au premier passage sur l'onglet Sport (« Envie de bouger avec Nutry ? »), jamais
imposé. Mêmes composants que l'onboarding Nourriture (une question par écran, Nutry dans une
bulle, « Continuer » sous le pouce). Textes dans `domain/training` (ADR 0010).

1. **Combien de fois par semaine ?** (1 à 6, cartes) puis les jours, préremplis
   (`DEFAULT_TRAINING_DAYS`), ajustables en pastilles.
2. **Où t'entraînes-tu ?** maison sans matériel, maison avec haltères ou élastiques, salle ;
   « Ajuster mon matériel » déplie les cases.
3. **Ton niveau ?** débutant (« je débute ou je reprends »), intermédiaire, confirmé.
4. **Ton objectif ?** forme, force, muscle, endurance.
5. **Combien de temps par séance ?** 20, 30, 45, 60 min.

Si la personne est enceinte ou allaite : une question de plus (« Où en es-tu ? » : 1er
trimestre, après, post-partum). Avant la première séance, les messages de sécurité qui
demandent un avis (grossesse, post-partum, condition de santé, 70 ans et plus) s'affichent avec
« J'ai compris » (`safetyAcknowledgedOn`).

## Plan d'implémentation par phases

Chaque phase laisse `npm run lint`, `typecheck`, `format:check`, `test:coverage` (90 % sur
domain et application) et `build` verts, et se termine par un commit. Les phases 1 et 2 sont
parallélisables ; 3 dépend de 1 et 2 ; 4 et 5 dépendent de 3 ; 6 clôt.

### Phase 0 — Conception (ce commit)

- Fichiers : cet ADR ; `src/domain/training/` (constantes, types, gabarits, `chooseSplit`,
  textes de sécurité, contrats) ; `application/ports/ExerciseCatalog.ts` ;
  `infrastructure/data/exerciseSchemas.ts`.
- Tests : `training.test.ts` (vocabulaires, gabarits, équilibres, 48 h exhaustif, textes),
  `exerciseSchemas.test.ts` (exemple de référence et refus).

### Phase 1 — Domaine (agent « domaine ») ; découpable en 1a / 1b

- 1a : `safety.ts` (`assessTrainingSafety`, `excludedTagsOf`), `cycle.ts`, `progression.ts`
  (`prescribe`), `duration.ts` (`estimateSessionMinutes`, `fitSessionToDuration`), `pain.ts`.
- 1b : `select.ts` (`isExerciseEligible`, `rankExercises`, `pickExercise`, `findAlternatives`),
  `plan.ts` (`planTrainingWeek`), `fingerprint.ts`, `session.ts` (`isSessionComplete`),
  `meals.ts` (`trainingDaysOf`), textes d'avis `TRAINING_NOTICES`, et un catalogue de test dans
  `src/domain/testing/` (~40 exercices couvrant chaque schéma × cadre).
- Tests : bornes de santé (69/70 ans, 17/18 ans, chaque étape de grossesse, cumul) ; propriété
  sur 200 profils à graine fixe : aucune étiquette exclue, 48 h respectées sur le programme
  produit, équilibres, plafond de volume, durée ≤ cible × 1,1, déterminisme ; progression
  (borne haute → charge, deux échecs → baisse, poids du corps → variante, allégée, maintien) ;
  cycle (blocs, reprise après 2 semaines) ; rotation (stable sur un bloc, accessoires
  hebdomadaires).
- Fin : contrats implémentés sous leur nom, `training.contracts.ts` réduit aux types encore
  utiles, couverture ≥ 90 %.

### Phase 2 — Données (agent « données », reprend le jeu préparé depuis wger)

- Fichiers : `scripts/exercises/build.ts` (brut wger → `exercises.json` : correspondance des
  muscles et du matériel décrite dans `training.constants.ts`, normalisation des licences,
  choix de la traduction française, crédits) ; `scripts/exercises/media.ts` (WebP 480 px,
  MP4 ≤ 1,5 Mo avec affiche) ; `src/infrastructure/data/exercises.json` ;
  `public/exercices/` ; `docs/EXERCICES.md` (crédits générés) ; `validate-data` étendu.
- Tests de contenu : schéma Zod ; fichiers présents et sans orphelin ; pour chaque schéma de
  force × cadre × niveau, au moins 2 candidats éligibles ; pour chaque profil protégé
  (grossesse après T1, 70 ans, condition de santé), au moins 1 candidat par créneau des
  gabarits ; consignes en français (pas d'anglais résiduel, contrôle par mots fréquents) ;
  `docs/EXERCICES.md` à jour.
- Fin : 150 à 200 exercices, chacun avec au moins une image ou une consigne illustrée par un
  pictogramme ; aucune licence hors liste.

### Phase 3 — Application et infrastructure (agent « application/infra »)

- Ports : `ExerciseCatalog` (déjà là), `TrainingRepository` (profil sportif, programmes),
  `SessionLogRepository`, `PainReportRepository`, `ScreenWakeLock`.
- Cas d'usage (`application/usecases/training.ts`) : `getTrainingProfile`,
  `saveTrainingProfile`, `getTrainingWeek` (charge ou génère, empreinte),
  `startSession`, `logSet`, `markExerciseDone`, `replaceExercise`, `reportPain`,
  `completeSession` (geste de la série), `getExerciseSheet`, `listExerciseCredits`,
  `getTrainingDays` ; tous les écrits sous le verrou sériel, échecs de stockage rendus en
  messages doux.
- Infrastructure : `StaticExerciseCatalog` (sépare `Exercise` et `ExerciseMedia`, construit la
  recherche YouTube par défaut), Dexie v4, `backupSchema.ts` v4 + migration 3 → 4 +
  alignement à la compilation, `UserDataStore` étendu, `NavigatorWakeLock`, PWA
  (`nutry-exercices`), CSP `media-src 'self'`. Fakes en mémoire dans `application/testing`.
- Tests : cas d'usage avec fakes (régénération par empreinte, douleur → remplacement et
  écartement, séance terminée → série), migrations Dexie, sauvegarde v3 → v4, durcissement des
  imports (bornes), `privacy.qa.test.ts` (seul hôte sortant : `www.youtube.com` en lien).

### Phase 4 — Interface (agent « UI »)

- Onglet Sport et route, onboarding Sport, pages Sport et Séance, feuille Tuto, minuteur
  (`useRestTimer`), pastilles de séries, feuille « Ça fait mal », page « Crédits exercices »,
  pictogrammes (haltère, minuteur), libellés dans `presentation/i18n/labels.ts` (test
  d'exhaustivité), marqueurs de séance dans le `DayStrip` de la Semaine.
- Tests (Testing Library) : parcours d'onboarding, cocher une série lance le minuteur (horloge
  simulée), « Fait » par exercice, tuto (crédit, lien externe `noopener noreferrer`), douleur
  (messages, remplacement), mention de prudence, accessibilité des onglets.
- Fin : écrans sans scroll de page de 360 × 640 à 1440 × 900 ; aucun texte métier dans les
  composants.

### Phase 5 — Nourriture et compagnon (agent « domaine » puis « UI »)

- `ScoreComponentKey` `sport` et fait « jour de séance » dans le scoring et
  « Pourquoi ce plat ? » (ADR 0006 complété), `GeneratePlanInput.trainingDays` ;
  `suggestActivityLevel` et sa carte dans « Moi » ; accessoires sportifs et `unlockAt`
  étendu (ADR 0012 complété), dessins SVG des accessoires.
- Tests : le bonus ne change jamais un filtre dur ni les portions ; profil protégé inchangé ;
  suggestion d'un cran au plus, refusable ; déblocage par séances cumulées, rien ne se reperd.

### Phase 6 — Bout en bout (agent « e2e »)

- `e2e/sport.spec.ts` : onboarding Sport → programme → séance (cocher, minuteur, fait,
  tuto, douleur) → fin → série de Nutry ; hors ligne après une première visite ;
  `sans-scroll.spec.ts` et `responsive.spec.ts` (axe) étendus aux écrans Sport ; `csp.spec.ts` :
  vidéo locale lue, aucune iframe, aucune requête vers un autre hôte ; captures
  (`docs/captures/sport.png`, `seance.png`) et README.

## Conséquences

- Le Sport reste facultatif : sans profil sportif, rien ne change pour la Nourriture.
- Toute nouvelle règle de sécurité s'ajoute dans `safety.constants.ts` et s'applique partout
  par le filtre d'éligibilité ; un test « aucune étiquette exclue » la protège.
- Le dépôt grossit (~10 à 15 Mo d'images et de vidéos) ; les médias restent hors précache.
- Questions ouvertes (valeurs par défaut retenues tant qu'elles ne sont pas tranchées) :
  plafond de 3 séances de renforcement pour une condition de santé déclarée ; accessoires
  sportifs débloqués par séances cumulées plutôt que par la série ; jour unique par défaut le
  samedi.
