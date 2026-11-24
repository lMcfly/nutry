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

## Épure et adaptation à l'appareil (révision du 2026-11-23)

Retour de l'utilisateur : « beaucoup trop chargé, ça ne donne pas envie » puis « la mise en page
n'est pas adaptée à l'appareil ». Les décisions ci-dessus sur la coque (pas de scroll de page,
feuilles, onglets ARIA) restent ; le **rendu** change. Cette section remplace les choix de
couleur, de densité et de pictogrammes de la première version.

### Principes d'épure

- **Une information principale et une à trois actions par écran.** Le reste passe dans un menu
  « ⋯ » (feuille) ou dans l'écran de détail. Rien n'est supprimé : Frigo vide, équilibre,
  cuisiner en avance, nouveau menu et rappel de sauvegarde sont dans le menu de la Semaine ;
  Partager et Tout décocher dans celui des Courses.
- **Une seule couleur d'accent : le vert sauge** (`--color-primary`), réservé à l'élément actif
  et à l'action principale. Le corail (`--color-accent`) n'est qu'un léger complément (flamme de
  la série, pastille d'attention). Fond crème `#f8f7f3`, surfaces blanches, filets de 1 px à la
  place des ombres, titres en 600, pas de majuscules. Thème sombre dérivé des mêmes rôles.
  `contrast.test.ts` reste la référence (AA texte, 3:1 composants et jauges).
- **Pictogrammes au trait** (`components/icons/`, SVG 24 px, trait 1,75, `currentColor`, décoratifs)
  à la place des emojis d'interface. Les emojis ne subsistent que dans le contenu (accessoires de
  Nutry, familles d'aliments de l'équilibre, « Bonjour 👋 »).
- **Composants** : `ListRow` / `ListGroup` (lignes de réglages façon iOS, remplacent `Tile`),
  onglets de texte soulignés (repas, sections de recette), rayons en pastilles douces, bandeau de
  jours sans cartes, cases de courses rondes et fines, bouton + flottant, `DishImage`.
- **Carte du repas** : toute la carte est un lien (lien étiré sur le nom, nom accessible « Voir la
  recette : … ») ; illustration, nom, « Simple · 17 min », « Pourquoi ce plat ? » sur une ligne et
  trois actions au trait. Les jauges d'assiette sont dans l'onglet Infos de la recette ;
  l'équilibre de la semaine s'ouvre depuis le menu ou depuis Progrès.
- **`DishImage`** prépare les vraies photos : `src` facultative et texte alternatif, repli sur
  l'illustration si elle manque ou ne charge pas (hors ligne), `object-fit: cover`, ratio fixe
  (4/3 sur la carte, 16/10 en tête de recette), `loading="lazy"` sauf l'image principale, même
  origine (CSP `img-src 'self'` à l'époque ; élargie par l'ADR 0014).

### Points de rupture

| Format                        | Condition                                    | Navigation             | Mise en page                                                                                                                                                                                                                                                       |
| ----------------------------- | -------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Téléphone portrait (≤ 767 px) | défaut                                       | barre d'onglets en bas | une colonne, pas de scroll de page ; carte du repas ancrée sous les onglets, image pleine largeur qui prend l'espace restant                                                                                                                                       |
| Téléphone paysage             | `orientation: landscape` et hauteur ≤ 539 px | rail compact           | mise en page téléphone ; `main` défile, chaque écran garde une hauteur de lecture                                                                                                                                                                                  |
| Tablette portrait             | ≥ 768 px et hauteur ≥ 540 px                 | rail latéral           | Semaine : bandeau de jours, puis **les repas du jour empilés** (cartes horizontales, image ~45 %), sans onglets ; Recette : grande image puis onglets ; Progrès : une colonne avec l'équilibre affiché ; feuilles en dialogue centré, réglages en panneau à droite |
| Tablette paysage, ordinateur  | ≥ 1000 px                                    | rail latéral           | Semaine : jours à gauche et **repas du jour côte à côte** (cartes verticales, grande image) ; Courses : rayons / liste ; Recette : image qui remplit la hauteur / onglets ; Profil : Nutry / réglages ; Progrès : deux colonnes                                    |
| Très grand écran              | ≥ 1280 px                                    | rail latéral           | colonne « Ta semaine » à droite de la Semaine (Nutry et série, équilibre, cuisiner en avance) ; contenu centré, 80 rem au plus                                                                                                                                     |

`WeekPage` choisit sa structure avec `useMediaQuery` (onglets repas au téléphone, repas du jour
ensemble dès 768 px, colonne latérale dès 1280 px) ; le reste est du CSS. `DishImage` a un mode
`fill` : le cadre prend la hauteur de son conteneur (hauteur minimale réservée, donc aucun décalage
quand une photo remplace l'illustration), l'image est posée en absolu avec `object-fit: cover`.

Tailles fluides (`clamp()` pour le titre, les marges, Nutry et les illustrations), unités en `rem`
(le texte suit la taille système), `viewport-fit=cover` et `env(safe-area-inset-*)` sur la barre,
le rail et la coque. Le rail est un `order: -1` du même `<nav>` : même ordre de lecture et de
tabulation partout.

### Vérifications

`e2e/sans-scroll.spec.ts` mesure, du 360 × 640 à 1440 × 900 (iPhone SE et 15, Pixel 7, iPad en
portrait et en paysage) : pas de scroll de page, rien de coupé dans `<main>`, aucun débordement
horizontal, navigation entièrement visible, et au moins 60 px de réserve sous Profil et Progrès
en 360 × 640. `e2e/responsive.spec.ts` ajoute axe (sans violation sérieuse) sur tablette et
ordinateur. Captures : `docs/captures/` (dont `tablette.png` et `ordinateur.png`).

## Saisie ludique, courses en tuiles, assiette, Nutry en cercle, onglet « Moi » (révision du 2026-11-24)

Retours : la saisie « fait Google Forms », la liste de courses « trop ligne, ligne, ligne », les
pourcentages déplaisent, Nutry doit être mis en valeur, Profil et Progrès sont réunis.

- **Onboarding, une question par écran** : Nutry pose la question dans une bulle (le titre de
  niveau 1 prend le focus à chaque écran), transition glissée coupée par
  `prefers-reduced-motion`, retour, barre fine, « Continuer » sous le pouce, « Passer » sur les
  questions facultatives. Les textes et l'ordre des questions sont dans
  `domain/profile/questions.ts` (ADR 0010) ; la question de grossesse n'apparaît que si le sexe
  n'est pas « homme ». Validation, messages d'erreur, `previewProfile` et garde-fous sont inchangés
  (`draft.ts`). Une carte de choix touchée au doigt passe seule à la suite (jamais au clavier, pour ne
  pas changer d'écran pendant qu'on parcourt les flèches ; jamais sur la dernière question).
- **Composants** : `NumberDial` (grand chiffre qui est un vrai champ, − / + avec appui long qui
  accélère, curseur `input range`), `RadioGroup` en `tiles` (cartes illustrées), `ChipGroup` en nuage
  (fond de l'accent et coche). `ProfileSections` expose `QuestionInput`, rendu en `wizard`
  (onboarding) ou en `list` (feuilles d'édition de « Moi » : toutes les questions d'une partie, avec
  interrupteurs pour les oui/non).
- **Courses** : grille de tuiles par rayon (3 colonnes téléphone, 4 tablette, 5 puis 6 dès 1000 et
  1280 px), emoji de l'aliment (`ingredientEmoji`, repli sur l'emoji du rayon), vraie case à
  cocher nommée « Ail, 6 gousses ». Cocher joue un « pop » puis envoie la tuile dans « Dans le panier
  (n) » (repliable, en bas du rayon). Anneau de progression « 12 / 57 », rayons en chips avec emoji.
  `aria-busy` sur `data-testid="shopping-list"` et persistance inchangés. « Frigo vide » reprend
  les emoji sur ses puces.
- **Assiette illustrée** (`PlateGauges`) : disque SVG en secteurs (légumes, féculents, protéines) et
  légende emoji + mot ; aucun pourcentage, la part se lit en mots dans `aria-label`
  (`describePlate`). Les autres jauges de la semaine n'affichent que des comptes (« 3 sur 4 »).
- **Nutry en cercle** (`CustomizeSheet`) : grand Nutry au centre, choix en bulles rondes sur un
  cercle (angles calculés en CSS), onglets Couleur / Yeux / Accessoires, cadenas et « à N jours »
  sur les éléments verrouillés, essai immédiat avec petit rebond ; `aria-pressed`, touche à
  nouveau un accessoire pour l'enlever.
- **Onglet « Moi »** (route `/moi`) remplace Profil et Progrès : 3 onglets (Semaine, Courses,
  Moi). `/profil` et `/progres` redirigent vers `/moi` (l'ancre `#mes-donnees` est conservée).
  Nutry en héros (un toucher ouvre la personnalisation), série et record, puis les progrès en cartes
  (`ProgressCards` : équilibre de la semaine en pastilles, favoris, historique, mesures ou tendance),
  sans pourcentage. Les réglages (Moi, Objectif et alimentation, Goûts, Organisation, Apparence
  et suivi, Mes données, Confidentialité) sont dans le bouton ⚙ « Réglages ». La mention médicale
  reste en pied de page. Dès 768 px : deux colonnes (Nutry et série à gauche, progrès à droite).
  Le quiz n'a pas de carte propre : ses statistiques ne sont exposées par aucun cas d'usage hors de la
  question du moment.
