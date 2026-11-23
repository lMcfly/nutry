# Mission

Tu es le lead développeur et l'orchestrateur d'un projet : créer **une PWA de bien-être et de rééquilibrage alimentaire**, en français, simple à prendre en main, publiée sur **GitHub** et utilisable via **GitHub Pages**.

Tu disposes de sous-agents spécialisés dans `.claude/agents/`. Délègue-leur le travail selon le plan de la section « Orchestration ». Tu restes responsable de la cohérence globale.

**Avant d'écrire la moindre ligne de code**, présente-moi : ton plan par phases, l'arborescence prévue et les questions qui bloquent. Attends ma validation.

---

# 1. Objectif de l'app

Aider l'utilisateur à **rééquilibrer son alimentation durablement** en lui proposant chaque semaine des repas adaptés à son profil (morphologie, activité, goûts, contraintes, temps disponible), avec une approche bienveillante : pas de régime strict, pas de culpabilisation, des portions et une assiette équilibrée plutôt que du comptage de calories.

Principes UX :
- Prise en main en moins de 2 minutes, onboarding court et skippable en partie.
- Mobile-first, gros boutons, peu de texte, navigation à 4 onglets max : **Semaine**, **Courses**, **Profil**, **Progrès**.
- Ton chaleureux et encourageant dans tous les textes.

---

# 2. Stack imposée

- **React 18 + TypeScript (strict) + Vite**
- **vite-plugin-pwa** : installable, fonctionne hors ligne (service worker, manifest, icônes).
- **Stockage 100 % local** : IndexedDB (via `idb` ou Dexie). Aucun compte, aucun serveur, aucune donnée envoyée.
- **Routing compatible GitHub Pages** : `HashRouter` (ou fallback `404.html`), `base` Vite = `/<nom-du-repo>/`.
- Style : CSS Modules ou Tailwind (au choix de l'agent UI, justifié), thème clair/sombre.
- Tests : **Vitest** + Testing Library ; un test **Playwright** de parcours principal.
- Qualité : ESLint, Prettier, Husky (pré-commit lint + tests).

---

# 3. Fonctionnalités

## 3.1 Onboarding & profil
Collecter, en 3-4 écrans maximum :
- Âge, sexe, taille (cm), poids (kg), **tour de taille (cm)**, niveau d'activité (sédentaire → très actif).
- Objectif : *rééquilibrer*, *perdre du poids en douceur*, *maintenir*, *reprendre de l'énergie*.
- Régime : omnivore, flexitarien, végétarien, végan, sans gluten, sans lactose.
- **Allergies** (exclusion stricte, jamais proposées).
- Aliments **aimés** et **détestés** (sélection par puces visuelles).
- Nombre de personnes au foyer (ajuste les portions et la liste de courses).
- Temps disponible en semaine / le week-end.
- Répartition des niveaux souhaitée (ex. semaine en *Simple*, week-end en *Expérimenter*).

Tout est modifiable ensuite dans **Profil**.

## 3.2 Moteur de rééquilibrage (cœur métier, couche domain)
- Calculs : **IMC**, **rapport tour de taille / taille** (seuil d'alerte 0,5), **métabolisme de base Mifflin-St Jeor**, besoins journaliers via coefficient d'activité.
- Objectif « perdre en douceur » : déficit **plafonné à 15 %** des besoins, avec un **plancher** (jamais sous 1 500 kcal pour un homme, 1 200 kcal pour une femme). Les autres objectifs restent à l'équilibre.
- Traduction des besoins en **portions** (modèle de l'assiette : ½ légumes, ¼ protéines, ¼ féculents complets) et en quantités dans les recettes. **Les chiffres de calories ne sont pas mis en avant dans l'UI** (affichables seulement dans un détail optionnel).
- **Garde-fous obligatoires**, gérés dans le domain et testés :
  - Moins de 18 ans, grossesse ou allaitement → aucun déficit, message invitant à consulter un professionnel de santé.
  - IMC < 18,5 → objectif de perte désactivé, message bienveillant.
  - Bandeau discret permanent dans Profil : « Cette app ne remplace pas l'avis d'un médecin ou d'un diététicien. »
- Le moteur est **une fonction pure**, entièrement testée (cas limites inclus).

## 3.3 Menu de la semaine
- 7 jours × déjeuner + dîner (petit-déjeuner en option dans le profil).
- **3 niveaux de recettes** :
  - **Simple** : ≤ 20 min, ≤ 6 ingrédients, aucune technique particulière.
  - **Médium** : 20 à 45 min, quelques étapes.
  - **Expérimenter** : saveurs ou techniques nouvelles, cuisine du monde.
- Génération par un **algorithme de scoring** : respect des contraintes (filtres durs), goûts et notes passées, saisonnalité, variété sur la semaine (pas deux fois la même protéine principale d'affilée, pas de doublon), temps disponible, niveau demandé.
- **Remplacer un repas d'un tap** (propose 3 alternatives du même niveau).
- **Restes** : un plat cuisiné en grande quantité peut alimenter le repas suivant (signalé visuellement).
- **Batch cooking** : option « session de préparation le dimanche » avec liste des préparations à anticiper.
- **Fruits et légumes de saison** (calendrier France) privilégiés.
- **Indicateur d'équilibre de la semaine** : jauges simples de variété (légumes, légumineuses, poissons, céréales complètes), sans calories.

## 3.4 Liste de courses
- Générée automatiquement depuis le menu, **quantités agrégées** selon le nombre de personnes.
- **Regroupée par rayon** (fruits & légumes, boucherie/poissonnerie, frais, épicerie, surgelés…).
- Cases à cocher, ajout manuel d'articles, partage via **Web Share API** (fallback : copier dans le presse-papiers).

## 3.5 Mode « frigo vide »
L'utilisateur coche les ingrédients qu'il a ; l'app propose les recettes compatibles avec son profil, triées par nombre d'ingrédients manquants.

## 3.6 Personnalisation continue
- Après un repas : **👍 / 👎** (+ raison optionnelle : trop long, pas aimé le goût, trop copieux…).
- Les notes ajustent les poids du scoring (apprentissage simple et explicable, pas de boîte noire).
- Écran « Pourquoi ce plat ? » : 1 ligne expliquant la proposition (« de saison, tu aimes le saumon, 15 min »).

## 3.7 Quiz de démarrage
- **À chaque ouverture de l'app** : une carte avec **1 question de culture générale**, 4 choix, fermable d'un geste.
- Après réponse : bonne réponse + **explication courte** (1-2 phrases).
- **Série (streak)** de bonnes réponses affichée, avec un petit encouragement.
- Environ 20 % de questions de **culture culinaire**, 80 % culture générale variée (histoire, géo, sciences, arts, sport, nature).
- Pas de répétition tant que la banque n'est pas épuisée. Fonctionne hors ligne.

## 3.8 Progrès
- Suivi du poids et du tour de taille **optionnel**, saisie **au plus une fois par semaine** (pas de pesée quotidienne encouragée).
- Courbe de **tendance** lissée, messages valorisant la régularité plutôt que le chiffre.
- Historique des menus et des recettes favorites.

## 3.9 Données & confidentialité
- Export / import des données en JSON, bouton « Tout effacer » avec confirmation.
- Écran « Confidentialité » expliquant que tout reste sur l'appareil.

---

# 4. Contenu

- **Recettes** : au moins **75 recettes en français** au départ (25 par niveau), dans `src/infrastructure/data/recipes.json`, couvrant tous les régimes listés. Schéma minimal :

```ts
interface Recipe {
  id: string;
  name: string;
  level: 'simple' | 'medium' | 'experiment';
  prepMinutes: number;
  cookMinutes: number;
  servings: number;
  diets: Diet[];            // compatibilités
  allergens: Allergen[];    // 14 allergènes réglementaires UE
  mainProtein: ProteinType;
  seasons: Season[];
  ingredients: { name: string; quantity: number; unit: Unit; aisle: Aisle }[];
  steps: string[];
  plateBalance: { vegetables: number; proteins: number; starches: number }; // proportions
  nutritionPerServing: { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
  tags: string[];           // "batch", "restes", "monde", "sans cuisson"…
}
```

- **Quiz** : au moins **300 questions** dans `src/infrastructure/data/quiz.json` (question, 4 choix, index correct, explication, catégorie, difficulté). Faits vérifiés, sans ambiguïté.
- Le schéma de chaque JSON est validé au build (Zod) et par un test.

---

# 5. Architecture : Clean Architecture

```
src/
├── domain/            # Entités, value objects, règles métier PURES (aucune dépendance externe)
│   ├── profile/       # Profile, calculs IMC, RTT, besoins, garde-fous
│   ├── recipe/
│   ├── mealplan/      # Algorithme de scoring et de génération
│   ├── shopping/
│   └── quiz/
├── application/       # Cas d'usage (GenerateWeeklyPlan, ReplaceMeal, RateMeal,
│   │                  # BuildShoppingList, GetDailyQuiz, AnswerQuiz, SuggestFromFridge…)
│   └── ports/         # Interfaces : RecipeRepository, ProfileRepository, QuizRepository, Clock…
├── infrastructure/    # Adaptateurs : IndexedDB, chargement JSON, Web Share, service worker
│   └── data/
├── presentation/      # React : pages, composants, hooks, design system
└── main.tsx           # Composition root : injection des dépendances
```

Règles :
- **Règle de dépendance** : `presentation → application → domain`, `infrastructure` implémente les ports. Le domain n'importe **rien** de React, du navigateur ou du stockage. Vérifié par `eslint-plugin-boundaries` (ou équivalent).
- Le temps (date du jour, saison) passe par un port `Clock` pour rendre les tests déterministes.
- Couverture de tests **≥ 90 % sur domain et application**.

---

# 6. GitHub & déploiement

- Initialise le dépôt git, commits conventionnels (`feat:`, `fix:`, `chore:`…), un commit par étape logique.
- **GitHub Actions** :
  - `ci.yml` : lint, typecheck, tests, build sur chaque push et PR.
  - `deploy.yml` : build et déploiement sur **GitHub Pages** depuis `main`.
- `README.md` en français : présentation, captures, lien vers l'app en ligne, installation sur téléphone (« Ajouter à l'écran d'accueil »), lancement en local, architecture, comment ajouter des recettes ou des questions.
- `LICENSE` (MIT), `CONTRIBUTING.md`, templates d'issues.
- Donne-moi à la fin les commandes exactes pour créer le dépôt distant (`gh repo create` ou manuel) et activer Pages, si tu ne peux pas le faire toi-même.

---

# 7. Orchestration des agents

| Phase | Agent principal | Livrable | Validation |
|---|---|---|---|
| 0. Cadrage | toi | Plan, arborescence, questions | **Moi** |
| 1. Architecture | `architecte` | Squelette, ports, ADR, config outillage | `reviewer` |
| 2. Domain | `nutrition` + toi | Moteur de rééquilibrage, scoring, tests | `nutrition` puis `qa` |
| 3. Contenu | `contenu` | recipes.json, quiz.json validés | `nutrition` (recettes), `qa` (schémas) |
| 4. Application & infra | toi | Cas d'usage, adaptateurs IndexedDB | `qa` |
| 5. Interface | `ui-ux` | Écrans, design system, accessibilité | `reviewer` |
| 6. PWA & déploiement | `devops` | PWA, CI/CD, GitHub Pages, README | `qa` |
| 7. Revue finale | `reviewer` | Rapport + corrections | **Moi** |

Règles d'orchestration :
- Chaque phase se termine par un récapitulatif court : ce qui est fait, ce qui reste, les décisions prises.
- Un agent ne passe à la suite que si les tests passent.
- En cas de doute sur une règle métier ou de santé, **demande-moi** plutôt que d'inventer.

---

# 8. Definition of Done

- [ ] L'app est en ligne sur GitHub Pages, installable et fonctionnelle hors ligne.
- [ ] Onboarding → menu de la semaine en moins de 2 minutes.
- [ ] Le quiz s'affiche à chaque ouverture, sans répétition.
- [ ] Les 3 niveaux, le remplacement, les restes, le batch cooking et la saisonnalité fonctionnent.
- [ ] Les allergies ne sont **jamais** violées (test dédié sur l'ensemble des recettes).
- [ ] Les garde-fous de santé sont testés et effectifs.
- [ ] Liste de courses agrégée par rayon et partageable.
- [ ] Notes 👍/👎 modifient visiblement les propositions suivantes.
- [ ] CI verte, couverture ≥ 90 % sur domain/application, Lighthouse PWA et accessibilité ≥ 90.
- [ ] README complet en français.
