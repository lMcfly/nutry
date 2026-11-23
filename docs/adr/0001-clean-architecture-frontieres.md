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
- **Injection sans framework** : `main.tsx` instancie les adaptateurs, fabrique les cas
  d'usage (`createUseCases(ports)`) et ne passe **que les cas d'usage** à
  `<DependenciesProvider>` ; les composants les lisent via `useDependencies()` (phase 4).
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

## Complément (revue de phase 1)

La règle de dépendance est aussi verrouillée contre les contournements suivants :

- **Globals du navigateur** : `tsconfig.core.json` compile `src/domain` et `src/application` sans lib DOM ni types, et ESLint interdit `window`, `document`, `navigator`, `localStorage`, `indexedDB`, `fetch`…
- **Temps et aléa** : `Date.now()`, `new Date()` sans argument et `Math.random()` sont interdits dans le cœur ; ils passent par les ports `Clock` et `RandomSource`.
- **Imports dynamiques** (`import('…')`) et **fichiers `.tsx`** interdits dans le cœur.
- **Ports** : ils ne déclarent que des types (règle ESLint), ce qui justifie leur exclusion de la couverture (avec les doublures de `src/domain/testing` et `src/application/testing`).

## Complément (revue finale)

- **Présentation en liste blanche** : `src/presentation` n'importe que `react`, `react-dom`, `react-dom/client`, `react-router-dom`, les alias `@domain`, `@application`, `@presentation` et des chemins relatifs (CSS compris), y compris par `import()` dynamique. Ses tests ajoutent `vitest` et Testing Library. Tout autre paquet (`dexie`, `zod`…) passe par un cas d'usage.
- **Confidentialité** : dans tout `src/`, `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` sont interdits, en global comme via `window.`, `globalThis.` ou `self.`, ainsi que `navigator.sendBeacon` ; `indexedDB` n'est permis que dans `src/infrastructure/db`.
- **Cœur** : `globalThis`, `self`, `performance`, `setTimeout` et `setInterval` rejoignent les globals interdits. `tsconfig.core.json` exclut tests et doublures (`*.test.ts`, `testing/`), typés par `tsconfig.core-tests.json` avec les mêmes contraintes (ni DOM ni Node).
- **Pas de contournement par commentaire** : `@eslint-community/eslint-comments` refuse tout `eslint-disable` visant `boundaries/*` ou `no-restricted-*`, les `eslint-disable` sans nom de règle et les commentaires de configuration (`/* eslint règle: off */`, `/* global */`).
