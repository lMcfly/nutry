# ADR 0005 — Zod pour valider les données embarquées

- Statut : accepté
- Date : 2026-11-23

## Contexte

`recipes.json` (≥ 75 recettes) et `quiz.json` (≥ 300 questions) sont saisis à la main. Une
erreur (allergène mal orthographié, index de réponse hors limites) pourrait casser l'app ou,
pire, laisser passer un allergène.

## Décision

- Schémas **Zod 3** dans `src/infrastructure/data/schemas.ts`, typés `z.ZodType<Recipe>` et
  `z.ZodType<QuizQuestion>` : le compilateur garantit l'alignement avec les types du domain.
- Les énumérations sont dérivées des tableaux `as const` du domain (`z.enum(ALLERGENS)`…).
- Contrôles structurels en plus : identifiants kebab-case uniques, valeurs sans doublon,
  proportions de l'assiette dont la somme vaut 1, 4 choix distincts.
- Validation à trois endroits : `npm run validate-data` (script `tsx`), exécuté en `prebuild` ;
  un test Vitest (`data.test.ts`) ; plus tard au chargement par les repositories JSON.

## Conséquences

- Zod n'entre jamais dans le domain (ADR 0001).
- Les règles de cohérence métier (ex. recette `vegan` sans allergène `lait`/`oeufs`) relèvent
  du domain (phase 2) et d'un test dédié sur l'ensemble des recettes.
