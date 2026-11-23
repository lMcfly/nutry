# ADR 0013 — Refonte visuelle : coque d'app sans scroll, Nutry et illustrations

- Statut : accepté (demande de l'utilisateur : design plus attrayant, « quelque chose sur une
  page », sans défilement)
- Date : 2026-11-23
- Complète : ADR 0004 (jetons et CSS Modules), ADR 0012 (compagnon)

## Contexte

L'interface d'origine empilait des cartes dans une longue page défilante. L'utilisateur la
trouve peu attrayante et ne veut **pas de scroll** : chaque écran doit tenir dans la hauteur du
téléphone. Il valide l'inspiration des applications de nutrition modernes (fond vert très
pâle, cartes blanches très arrondies, accent corail, bandeau de jours, onglets segmentés,
illustrations plates, jauges colorées) et ne veut **pas de calories mises en avant**.

## Décision

### Coque d'app

- `html`, `body` et la coque (`App.module.css`) font `100dvh` et ne défilent pas : en-tête
  compact, contenu qui remplit la hauteur restante, barre d'onglets (4 au plus) en bas.
- Seules les listes intrinsèquement longues défilent, **dans leur carte** : un rayon de
  courses, les ingrédients et étapes d'une recette, les sections d'une feuille plein écran.
  Elles passent par `ScrollArea` (région nommée, focalisable au clavier : règle axe
  `scrollable-region-focusable`). `Page` accepte `scroll` pour les écrans secondaires (Frigo
  vide, Confidentialité).
- Cible : 360 × 640 au minimum et Pixel 7. Les écrans bas (`max-height: 760px`) passent la
  carte du repas en deux colonnes (illustration à côté du nom). `e2e/sans-scroll.spec.ts`
  vérifie, dans les deux tailles, que la page ne défile pas **et** que le contenu de
  `<main>` ne déborde pas (sinon la règle serait vérifiée à vide).

### Navigation et gestes

- Semaine : bandeau des 7 jours, onglets repas du jour, une grande carte. Un glissement
  horizontal (`Swipeable`, pointer events, sans bibliothèque, `touch-action: pan-y`) passe au
  repas suivant ou précédent ; les boutons ‹ › et les flèches du clavier sont toujours
  disponibles. Les onglets sont de vrais `tablist` (`SegmentedTabs` : un seul onglet dans
  l'ordre de tabulation, flèches, Début, Fin).
- Les contenus secondaires (équilibre, cuisiner en avance, saisie d'une mesure, ajout d'un
  article, favoris, historique) s'ouvrent dans des feuilles (`Sheet`) ; le Profil ouvre des
  feuilles **plein écran** (variante `full`). Quand deux fenêtres sont empilées (célébration
  sur la question du moment), seule celle du dessus réagit à Échap et à Tab.

### Jetons et composants

- Fond vert très pâle, surfaces blanches, rayons très arrondis, accent **corail** (primaire)
  et **vert feuille** (accent) ; jauges : légumes vert, protéines corail, féculents ambre,
  poisson bleu (`--gauge-*`). Thème sombre cohérent. `contrast.test.ts` vérifie les paires de
  texte (AA) et les jauges (3:1 sur la carte et sur leur piste).
- Composants : `SegmentedTabs`, `DayStrip`, `Gauge` horizontale, `RoundIconButton`, `Tile`,
  `Sheet` plein écran, `Swipeable`, `ScrollArea`. Zones tactiles ≥ 44 px.
- Aucune calorie à l'écran, sauf dans le détail repliable de la recette (et le détail
  énergétique du Profil, repliable lui aussi). Le menu parle en **assiette** : trois jauges
  (légumes, protéines, féculents) d'après `plateBalance`, part de chaque famille dans
  l'assiette.

### Nutry et illustrations

- `features/companion/Nutry.tsx` : SVG pur (teinte en dégradé, yeux, joues, bouche selon
  l'humeur, calques d'accessoires par emplacement, teintes spéciales aurore, cosmos étoilé et
  arc-en-ciel), `role="img"` avec une description de l'apparence et de l'humeur. Animations
  CSS légères coupées par `prefers-reduced-motion` (testé sur la feuille de style).
- `illustrations/` : 15 familles de plats en SVG plat, choisies par `pickDishFamily` (étiquette
  petit-déjeuner, mots du nom, puis protéine principale ; testée). Décoratives
  (`aria-hidden`) : le nom du plat est toujours affiché. Aucune image externe (CSP
  inchangée).
- La célébration (`CelebrationProvider`, `useCelebrationCheck`) est vérifiée à l'ouverture et
  après chaque geste, puis acquitte (`acknowledgeUnlocks`) avant de se refermer. La
  présentation n'appelle que les cas d'usage (`getCompanion`, `customizeCompanion`,
  `acknowledgeUnlocks`).

## Conséquences

- Les écrans sont plus denses et plus gestuels ; tout reste faisable au clavier et au lecteur
  d'écran (boutons équivalents au glissement, onglets ARIA, noms explicites).
- Ajouter une famille de plats : un dessin dans `dishes.tsx`, son entrée dans `DISH_FAMILIES`
  et une règle dans `match.ts` (le test vérifie la couverture des 15 familles).
- Si une nouvelle carte dépasse la hauteur d'un petit écran, `sans-scroll.spec.ts` échoue :
  réduire le contenu ou le faire défiler dans sa carte.
