# ADR 0001 — Clean Architecture et frontières entre couches

- Statut : accepté
- Date : 2026-11-23

## Contexte

Le cœur de Nutry (moteur de rééquilibrage, scoring des menus, garde-fous de santé) doit être
testable à 90 % et plus, déterministe et indépendant de React, du navigateur et du stockage.

## Décision

Quatre couches sous `src/`, avec des alias `@domain`, `@application`, `@infrastructure`,
`@presentation` (tsconfig, Vite, Vitest) :

| Couche           | Peut importer                                |
| ---------------- | -------------------------------------------- |
| `domain`         | `domain` uniquement, aucune bibliothèque     |
| `application`    | `application`, `domain`, aucune bibliothèque |
| `infrastructure` | `infrastructure`, `application`, `domain`    |
| `presentation`   | `presentation`, `application`, `domain`      |
| `src/main.tsx`   | tout (composition root)                      |

- Les **ports** (interfaces) vivent dans `application/ports` ; l'infrastructure les implémente.
- Le temps (`Clock`) et l'aléa (`RandomSource`) sont des ports : tests déterministes.
- **Injection sans framework** : `main.tsx` instancie les adaptateurs et les passe à
  `<DependenciesProvider>` ; les composants les lisent via `useDependencies()`.
- Les vocabulaires fermés (régimes, allergènes…) sont des tableaux `as const` du domain, dont
  dérivent les types TS et les schémas Zod (ADR 0005).

## Application des règles

- `eslint-plugin-boundaries` (`boundaries/dependencies`, politique `default: disallow`) contrôle
  les imports entre couches, par alias comme par chemin relatif, y compris les `import type`.
  `boundaries/no-unknown-files` interdit tout fichier hors couche ; `main.tsx` est classé via
  `boundaries/files` (catégorie `composition-root`).
- `no-restricted-imports` interdit toute dépendance externe (npm, `node:*`) dans `domain` et
  `application`, hors fichiers de test.
- Vérifié lors de la mise en place : un import domain → infrastructure fait échouer `npm run lint`.

## Conséquences

- Ajouter une bibliothèque au cœur demande un nouvel ADR (ex. une lib de dates : préférer des
  fonctions pures maison).
- Les schémas Zod restent dans l'infrastructure, jamais dans le domain.
