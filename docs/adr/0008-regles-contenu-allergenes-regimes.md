# ADR 0008 — Règles de contenu : allergènes, régimes et grossesse

- Statut : proposé (à valider par l'utilisateur et, idéalement, par un·e diététicien·ne)
- Date : 2026-11-23

## Contexte

La relecture nutritionnelle des 88 recettes (phase 3) a montré que plusieurs cas n'ont pas de
réponse unique : la composition d'un produit du commerce change selon la marque, et les
régimes ou les recommandations pendant la grossesse laissent une part d'interprétation. Le
filtre d'allergènes et de régimes étant **strict** (ADR 0006), le contenu retient la règle la
plus prudente pour la personne, tant qu'elle ne vide pas le catalogue.

## Décision

### Allergènes des produits composés du commerce

On déclare l'allergène quand la **composition la plus courante en France** le contient, même si
certaines marques en sont exemptes. La table `ALLERGEN_KEYWORDS` impose ces déclarations (erreur
d'audit si l'allergène manque), sauf les lignes marquées « contenu » qui sont une convention
appliquée par les recettes sans contrôle automatique :

| Ingrédient                              | Allergènes déclarés                   | Raison                                              |
| --------------------------------------- | ------------------------------------- | --------------------------------------------------- |
| moutarde (Dijon, à l'ancienne)          | moutarde, **sulfites**                | disulfite de potassium (E224) comme conservateur    |
| mayonnaise, vinaigrette                 | œufs (mayonnaise), moutarde, sulfites | contiennent de la moutarde de Dijon                 |
| graines de moutarde                     | moutarde                              | graines entières, sans conservateur                 |
| ketchup                                 | céleri                                | extraits d'épices au céleri (marque leader)         |
| bouillon (cube, fond, fumet)            | céleri ; gluten (contenu)             | céleri presque toujours présent ; blé dans certains |
| pâte de curry thaïe                     | crustacés, poissons                   | pâte de crevette, sauce poisson                     |
| pesto                                   | lait, fruits à coque                  | parmesan ; noix de cajou fréquentes                 |
| chocolat                                | lait, soja                            | lait ou traces, lécithine de soja                   |
| gnocchis                                | gluten, œufs                          | farine de blé ; œuf dans certaines marques          |
| grana padano                            | lait, œufs                            | lysozyme d'œuf                                      |
| surimi                                  | poissons, crustacés, œufs             | chair de poisson, arôme crabe, blanc d'œuf          |
| tortillas de maïs, galettes de blé noir | gluten (contenu)                      | souvent coupées de farine de blé                    |
| flocons d'avoine                        | gluten                                | avoine non certifiée : contamination par le blé     |

Une mention « sans gluten » dans le nom de l'ingrédient (produit certifié) lève l'allergène
gluten.

### Régimes

- **Végétarien** : ni chair animale ni gélatine (déjà en place), et **aucun fromage
  d'appellation dont le cahier des charges impose une présure animale** (parmesan / Parmigiano
  Reggiano, grana padano, pecorino, gorgonzola, comté, beaufort, gruyère, reblochon, roquefort),
  sauf si le nom précise « végétarien » ou « sans présure animale ». Les autres fromages
  (mozzarella, feta, chèvre frais, emmental, paneer, fromage blanc…) existent couramment avec un
  coagulant microbien : ils restent acceptés, avec l'étiquette à vérifier. Le contrôle est
  `checkDietConsistency` (erreur `regime-ingredient`). Conséquence : le risotto au parmesan
  n'est plus végétarien (il reste flexitarien).
- **Sans gluten** : l'avoine non certifiée, les tortillas de maïs et galettes de sarrasin du
  commerce sont comptées avec gluten.
- **Sans lactose** : strict, aucun allergène lait (fromages affinés compris).

### Grossesse et allaitement (étiquette `cru`, ADR 0007)

Étiquette `cru` obligatoire pour : poisson ou fruits de mer crus ou marinés (tartare, ceviche),
poisson fumé ou mariné à froid (saumon fumé, gravlax), œuf au jaune coulant (coque, poché,
miroir), viande crue ou saignante, charcuterie crue, foie gras, fromage au lait cru **à pâte
molle ou persillée**, graines germées crues.

Ne déclenchent pas `cru`, conformément aux repères de l'Anses et de Santé publique France :
fromages à **pâte pressée cuite** (parmesan, comté, emmental), fromages pasteurisés, charcuterie
cuite (jambon blanc), graines germées cuites à cœur. Les recettes à base de poisson cru
précisent la congélation préalable (7 jours à −18 °C) contre les parasites.

## Conséquences

- Moins de recettes pour une personne allergique aux sulfites (6 plats de plus portent
  l'allergène) : c'est voulu, l'allergène est réellement présent dans les produits courants.
- Les recettes qui veulent rester accessibles peuvent nommer un produit sans l'allergène
  (« moutarde sans sulfites », « parmesan végétarien », « flocons d'avoine sans gluten »).
- Points à faire valider par un professionnel : seuils de sulfites (la réglementation impose la
  mention au-delà de 10 mg/kg, une cuillère de moutarde dans un plat en apporte bien moins),
  fruits rouges surgelés consommés crus pendant la grossesse, traces (« peut contenir »)
  non gérées.
