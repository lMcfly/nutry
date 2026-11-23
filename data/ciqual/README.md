# Données nutritionnelles Ciqual

Source : **Table de composition nutritionnelle des aliments Ciqual 2025** (Anses), Licence
Ouverte / Etalab. `ciqual-2025.json` est conservé tel quel (valeurs pour 100 g de partie
comestible). Ce dossier est **hors de `src/`** : rien n'entre dans le bundle de l'app, seules
les valeurs calculées sont écrites dans `src/infrastructure/data/recipes.json`.

- `npm run nutrition:write` : recalcule `nutritionPerServing` de toutes les recettes et réécrit
  `recipes.json` (formaté par Prettier).
- `npm run nutrition:check` : signale les écarts sans écrire.
- `scripts/nutrition/compute.test.ts` échoue si un ingrédient n'a pas de correspondance, si un
  code Ciqual n'existe pas (ou a une énergie manquante), si une unité non massique n'a pas de
  conversion, ou si `recipes.json` diffère du recalcul.

## `ingredients.json`

Clé = nom d'ingrédient **exactement** tel qu'écrit dans `recipes.json`.

| Champ           | Rôle                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------- |
| `ciqualCode`    | aliment Ciqual retenu                                                                         |
| `gramsPerUnit`  | grammes de partie comestible par unité non massique (`piece`, `cuillere-soupe`, `cl`, …)      |
| `ediblePortion` | part comestible quand la quantité est pesée brute (moules en coquille : 0,25 ; potiron : 0,7) |
| `approx`        | correspondance approchée : raison et aliment retenu                                           |
| `dilution`      | part de l'aliment Ciqual, le reste étant de l'eau (lait de coco allégé : 0,5)                 |

## Conventions

- **État de l'aliment** : celui de la pesée dans la recette. Féculents, légumineuses sèches et
  viandes/poissons sont pesés **crus/secs** ; les conserves sont comptées **égouttées**
  (pois chiches, lentilles, haricots, maïs, thon) et la boîte vaut son poids net égoutté
  (ex. pois chiches 265 g, thon 104 g) ; les tomates concassées comptent le contenu entier (400 g).
- **Légumes en grammes** : poids net épluché, sauf `ediblePortion` explicite.
- **Pièces** : partie comestible moyenne (œuf 55 g, oignon 100 g, gousse d'ail 5 g, citron 80 g
  de chair, pavé de saumon 125 g, côtelette d'agneau 50 g de viande…).
- **Cuillères** : 15 ml / 5 ml multipliés par la densité (huile 14 g / 4,5 g ; épices en poudre
  2 g la cuillère à café ; herbes sèches 1 g ; pincée 0,3 g, safran 0,1 g).
- **Liquides** : `cl` = 10 ml × densité (lait 10,3 g, vin 9,9 g) ; `l` = 1 000 g pour l'eau et
  le bouillon.
- **Rien n'est ignoré en silence** : eau, sel… ne sont comptés que s'ils sont listés, et alors via
  leur fiche Ciqual (eau du robinet : 0 kcal). Sel et poivre « à ton goût » des étapes ne sont pas
  listés et ne comptent pas.
- **Arrondis** : kcal à l'unité ; protéines, glucides, lipides et fibres à **0,1 g**.
- L'alcool du vin est compté en entier (pas de perte à la cuisson) : choix conservateur.
- Une fiche dont l'énergie vaut 0 alors que des macronutriments sont renseignés est incomplète
  (valeur manquante convertie en 0 par la source) : elle est refusée par le test.

## Allergènes, régimes et grossesse

Les règles de déclaration des allergènes des produits du commerce (moutarde → sulfites,
ketchup → céleri, avoine → gluten…), la règle « végétarien » pour les fromages à présure
animale (parmesan, comté…) et les cas qui imposent l'étiquette `cru` sont décrits dans
`docs/adr/0008-regles-contenu-allergenes-regimes.md`. En résumé : en cas de doute sur la
composition d'un produit courant, l'allergène est déclaré.

Les fromages des recettes sont supposés **pasteurisés**, sauf les pâtes pressées cuites
(parmesan, emmental), compatibles avec la grossesse selon l'Anses.
