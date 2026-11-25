# ADR 0010 — Textes d'interface en français dans le domain et l'application

- Statut : accepté
- Date : 2026-11-23

## Contexte

La Clean Architecture (ADR 0001) laisse la présentation formuler ce que voit l'utilisateur.
Pourtant plusieurs règles métier produisent directement des phrases : un garde-fou de santé
n'a de sens qu'avec son message bienveillant, « Pourquoi ce plat ? » est une explication du
score, un échec d'import doit dire quoi faire. Nutry est une app **mono-langue** (français),
sans projet de traduction.

## Décision

On assume des textes d'interface en français dans `domain` et `application`, quand ils sont
indissociables d'une règle. Ils restent des **constantes exportées** (ou des fonctions pures),
testées, jamais construites dans un composant :

| Où                                                                   | Quoi                                                                                                                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/profile/guards.ts`                                           | `HEALTH_MESSAGES` (garde-fous de santé)                                                                                                                                               |
| `domain/profile/profile.constants.ts`                                | `MEDICAL_DISCLAIMER` (bandeau Profil, écran Confidentialité)                                                                                                                          |
| `domain/profile/validate.ts`                                         | messages de `ProfileIssue`                                                                                                                                                            |
| `domain/profile/questions.ts`                                        | questions de Nutry (neuf écrans thématiques de l'onboarding, `ONBOARDING_SCREENS`) et intitulés des réponses ; la grossesse n'est demandée qu'aux personnes concernées                |
| `domain/recipe/plate.ts`                                             | part de l'assiette en mots (« environ un quart »), jamais en pourcentage                                                                                                              |
| `domain/mealplan/explain.ts`, `labels.ts`                            | « Pourquoi ce plat ? », `DAY_NAMES`, `SLOT_NAMES`, `mealLabel`                                                                                                                        |
| `domain/mealplan/generate.ts`                                        | `PLAN_NOTICES`                                                                                                                                                                        |
| `domain/mealplan/batch.ts`                                           | `BATCH_PREP_TEXTS` (cuisiner en avance le dimanche)                                                                                                                                   |
| `domain/progress/progress.ts`                                        | messages de régularité et de saisie                                                                                                                                                   |
| `domain/quiz/quiz.ts`                                                | encouragements après une réponse au quiz                                                                                                                                              |
| `domain/shopping/*`                                                  | rayons (`SECTION_LABELS`), pluriels, texte de partage, emoji des aliments (`ingredientEmoji`)                                                                                         |
| `application/usecases/data.ts`                                       | `IMPORT_MESSAGES`, `STORAGE_FAILURE_MESSAGES`                                                                                                                                         |
| `application/usecases/progress.ts`                                   | `WEIGHT_TRACKING_DISABLED_MESSAGE`                                                                                                                                                    |
| `application/usecases/shopping.ts`                                   | titre du texte partagé                                                                                                                                                                |
| `application/usecases/catalog.ts`                                    | `PHOTO_CREDITS_TEXTS` (écran Crédits photos, attributions Unsplash, mention CC BY-SA)                                                                                                 |
| `domain/training/safety.constants.ts`, `notices.ts`, `onboarding.ts` | `TRAINING_SAFETY_MESSAGES`, `TRAINING_DISCLAIMER`, `TRAINING_NOTICES`, questions et réponses de l'onboarding Sport (`TRAINING_QUESTIONS`, `TRAINING_ANSWERS`), messages de validation |
| `application/usecases/training.ts`                                   | `TRAINING_FAILURE_MESSAGES`, `TRAINING_MESSAGES` (séance introuvable, série refusée, rien de coché, pas de remplaçant), `EXERCISE_CREDITS_TEXTS` (écran Crédits exercices)            |

Les **libellés des identifiants** (niveaux, régimes, allergènes, thèmes…) restent dans
`presentation/i18n/labels.ts`, vérifiés exhaustifs par `labels.test.ts` ; les identifiants du
domain restent en ASCII kebab-case.

## Conséquences

- Un texte se corrige à un seul endroit, et les tests du domain vérifient le ton (pas de
  calories, pas de culpabilisation).
- Une traduction demanderait d'extraire ces constantes vers des clés : chantier identifié,
  non prévu.
