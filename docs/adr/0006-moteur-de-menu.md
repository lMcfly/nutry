# ADR 0006 — Moteur de menu : scoring, apprentissage, restes

- Statut : accepté
- Date : 2026-11-23

## Contexte

Le menu de la semaine doit respecter des contraintes strictes (allergies, régimes, aliments
détestés), s'adapter au profil (temps, niveau, goûts) et aux avis 👍/👎, sans « boîte noire » :
l'utilisateur doit pouvoir lire « Pourquoi ce plat ? ». Le domain reste pur : la date et l'aléa
arrivent en paramètres (`startDate`, `rng: () => number`).

## Décision

### Filtres durs (`domain/recipe/compatibility.ts`)

`isRecipeCompatible` est appliqué par **toutes** les fonctions qui proposent une recette
(`generateWeeklyPlan`, `replaceMeal`, `suggestFromFridge`) : aucun allergène déclaré, tous les
régimes de la personne présents dans `recipe.diets`, aucun aliment détesté (ingrédient ou
`mainProtein`, comparaison sans accents ni pluriel simple). Les termes génériques sont
étendus par une table de synonymes (`FOOD_SYNONYMS` : « viande » → bœuf, poulet, jambon… ;
« poisson », « fruits de mer », « fromage », « porc », « champignons », « épicé »…), aussi pour
les aliments aimés ; `FOOD_PREFERENCE_CHIPS` fournit les puces de l'onboarding. Un test
« propriété » (`allergen-safety.test.ts`, 200 profils aléatoires à graine fixe) le vérifie.
`auditRecipe` signale en **erreur** un ingrédient révélant un allergène non déclaré
(`ALLERGEN_KEYWORDS`, ex. « crème » → lait, sauf « crème de coco »).

### Score explicable (`domain/mealplan/scoring.ts`)

Score = somme de composantes nommées, renvoyées avec le repas (`PlannedMeal.score`) :

| Composante | Points                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------- |
| `aime`     | +2 par aliment aimé présent, plafonné à +4                                               |
| `notes`    | poids appris (voir plus bas)                                                             |
| `saison`   | +1,5 si la recette convient à la saison du jour ; +0,5 par produit du mois (max +1,5)    |
| `temps`    | +1,5 × (1 − durée / temps dispo) si ça tient, −3 sinon ; +1 batch en semaine si option   |
| `niveau`   | +2 si niveau demandé, −1 sinon, 0 au petit-déjeuner                                      |
| `variete`  | +1 protéine nouvelle dans la semaine, −0,5 par occurrence déjà servie, −4 si consécutive |
| `hasard`   | tirage `rng` dans [0 ; 0,5) pour départager et varier d'une semaine à l'autre            |

Les faits ayant conduit au score (`facts` : aliments aimés trouvés, saison, durée, avis positif,
batch…) alimentent `explainMeal` (« De saison, saumon au menu comme tu aimes, 15 min »).

### Génération (`domain/mealplan/generate.ts`)

- Semaine du lundi au dimanche ; niveau et temps par jour (lun-ven / sam-dim). Le temps du profil
  est un temps **par repas**.
- Algorithme glouton chronologique : pour chaque repas, meilleure recette respectant tout ; sinon
  assouplissements successifs : niveau → recette évitée (👎 « pas aimé ») → variété de protéine →
  doublon → temps (dans ce dernier cas, la recette la plus courte). La variété passe avant le
  niveau : mieux vaut un plat d'un autre niveau que deux fois la même protéine. Les contraintes assouplies sont notées dans
  `PlannedMeal.relaxed` et un avis `contraintes-assouplies` est ajouté au plan.
- Variété : pas deux repas principaux consécutifs avec la même `mainProtein` (sauf `aucune` et
  restes) ; aucune recette en double (hors restes). Le petit-déjeuner est hors de ces règles
  (rotation complète des recettes `petit-dejeuner` avant répétition).
- Petit-déjeuner : recettes étiquetées `petit-dejeuner`, exclues des déjeuners/dîners. Sans
  recette compatible, pas de créneau et un avis `petit-dejeuner-indisponible`.

### Restes et batch cooking

- Un dîner étiqueté `restes` (hors dimanche) alimente le déjeuner du lendemain : même recette,
  `isLeftover: true`, `leftoverOf` = id du dîner. Au plus 3 par semaine (`MAX_LEFTOVERS_PER_WEEK`),
  désactivable (`leftovers: false`).
- Liste de courses : le plat est compté une fois, quantités × (1 + nombre de repas de restes).
- `replaceMeal` tient compte des protéines du repas précédent **et du repas suivant**
  (`nextProtein` ; pour un dîner à restes, le repas qui suit ses restes) et place les recettes
  évitées en dernier.
- `applyReplacement` : les restes suivent le plat remplacé ; un repas « restes » remplacé redevient
  cuisiné.
- Batch cooking : `buildBatchCookingPlan` liste les recettes `batch` cuisinées dans la semaine et
  les repas concernés (« mardi – dîner »).

### Apprentissage (`domain/preferences/weights.ts`)

Poids recalculés à partir de **tous** les avis (somme puis bornage : indépendant de l'ordre) :

| Avis                                      | Recette | Protéine | Chaque étiquette |
| ----------------------------------------- | ------- | -------- | ---------------- |
| 👍                                        | +2      | +0,5     | +0,25            |
| 👎 « pas aimé », « autre » ou sans raison | −3      | −0,75    | −0,25            |
| 👎 « trop long » ou « trop copieux »      | −1      | 0        | 0                |

Bornes : recette ±6, protéine ±2, étiquette ±1. « Trop long » (même avec un 👍) ajoute 1 point
de malus, plafonné à 3, aux recettes de plus de 30 min. « Trop copieux » multiplie le facteur de
portion par 0,95 (plancher 0,8). Les **favoris** sont déduits des avis (`favoriteRecipeIds` :
au moins un 👍 et solde 👍 − 👎 positif), sans stockage dédié.

Un 👎 « pas aimé » rend en plus la recette **évitée** (`avoidedRecipes`, `avoidedRecipeIds`) tant
qu'aucun 👍 plus récent n'existe : contrainte souple, assouplie juste après le niveau et signalée
`evitee` dans `PlannedMeal.relaxed`. Les autres 👎 ne donnent que le malus de score.

### Choix associés

- Saison : découpage par mois entiers (mars-mai printemps…), aligné sur le calendrier des
  fruits et légumes (`SEASONAL_PRODUCE`, 46 produits).
- Portions : facteur = cible / 2 000 borné [0,8 ; 1,3]. Catégorie d'ingrédient : basique ou dosé
  en pincée/cuillère → inchangé ; rayon fruits & légumes (hors pommes de terre, patate douce) →
  jamais réduit ; le reste → facteur de la personne. Les autres membres du foyer comptent pour 1.
- Équilibre de la semaine (sans calories) : légumes **différents** / 10, repas avec légumineuses
  / 2, repas de poisson ou fruits de mer / 2, repas avec céréale complète / 7.
- Progrès : une mesure par semaine **calendaire** (lundi → dimanche), correction possible à la
  même date ; tendance par lissage exponentiel (α = 0,4).
- Performance : `tokenize` et `findProduce` sont mémoïsés (cache borné, sans effet observable) ;
  un menu se génère en ~2 ms sur 25 recettes.

## Conséquences

- Tous les barèmes sont des constantes exportées (`SCORE_RULES`, `LEARNING_RULES`,
  `BALANCE_TARGETS`) : ajustables et testés.
- L'algorithme glouton ne garantit pas l'optimum global ; avec un catalogue pauvre pour un profil
  très contraint, des assouplissements apparaissent (signalés, et remplaçables d'un tap).
- Les seuils de santé et cibles nutritionnelles restent à faire valider par un professionnel.
