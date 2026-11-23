# Contribuer à Nutry

Merci de ton intérêt pour Nutry ! Toute aide est la bienvenue : code, recettes, questions de
quiz, relecture, accessibilité, traductions de messages plus chaleureux…

Avant tout, garde en tête l'esprit du projet : **bienveillance, pas de culpabilisation, pas
de comptage de calories mis en avant, et aucune donnée qui quitte l'appareil**.

## Prérequis

- **Node.js 22.12** ou plus récent (exigé par Vitest 5) et npm ;
- Git ;
- pour les tests de bout en bout : `npx playwright install chromium` (une fois).

```bash
git clone https://github.com/lMcfly/nutry.git
cd nutry
npm ci          # installe aussi les hooks Git (Husky)
npm run dev     # http://localhost:5173/nutry/
```

## Proposer un changement

1. Ouvre d'abord une [issue](https://github.com/lMcfly/nutry/issues/new/choose) pour une
   évolution importante, afin d'en discuter.
2. Crée une branche depuis `main` (`feat/frigo-vide-tri`, `fix/liste-courses-unites`…).
3. Fais des commits petits et cohérents, puis ouvre une pull request en remplissant le modèle.
4. La CI doit être verte : lint, types, format, tests et couverture, build et tests e2e.

### Commits conventionnels

Les messages suivent [Conventional Commits](https://www.conventionalcommits.org/fr/), en
français, avec la couche ou le sujet en portée :

```
feat(mealplan): privilégier les restes le lendemain d'un plat batch
fix(shopping): additionner les gousses d'ail de plusieurs recettes
docs: expliquer l'installation sur iPhone
test(domain): cas limite de l'IMC à 70 ans
content(recettes): ajouter le dahl de lentilles corail
```

Types courants : `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `style`, `ci`, `build`,
`chore`, `content` (recettes, quiz).

### Hooks Git

`npm ci` installe un hook **pre-commit** (Husky) qui lance `lint`, `typecheck`,
`format:check` et les tests. Si le hook échoue, corrige plutôt que de le contourner ;
`npm run format` règle la mise en forme.

## Tests

| Commande                | Quand                                                          |
| ----------------------- | -------------------------------------------------------------- |
| `npm test`              | toujours                                                       |
| `npm run test:coverage` | couverture ≥ 90 % exigée sur `src/domain` et `src/application` |
| `npm run e2e`           | si tu touches l'interface, la PWA ou le build                  |

- Le `domain` est testé sans navigateur, avec des dates et un aléa injectés (`Clock`,
  `RandomSource`).
- Toute règle de santé ou d'allergie se teste explicitement, cas limites compris.
- L'interface se teste avec Testing Library, par les rôles et les libellés accessibles.

## Règles d'architecture

Nutry suit une Clean Architecture (voir le [README](README.md#architecture) et
[`docs/adr/`](docs/adr/)) :

- `presentation → application → domain` ; l'`infrastructure` implémente les ports de
  l'application ; seul `src/main.tsx` assemble le tout.
- Le `domain` et l'`application` n'importent **aucune** bibliothèque ni API du navigateur
  (`window`, `fetch`, `Date.now()`, `Math.random()`…) : ESLint le refuse.
- Les ports (`src/application/ports/`) ne contiennent que des types.
- Une décision structurante s'écrit dans un nouvel ADR (`docs/adr/NNNN-titre.md`).
- TypeScript strict : pas de `any`, pas de `@ts-ignore`.
- Pas de ressource tierce (police, CDN, analytics) : l'app doit rester hors ligne et privée.

## Contenu : recettes et quiz

La marche à suivre est détaillée dans le README :
[ajouter une recette](README.md#ajouter-une-recette) et
[ajouter une question de quiz](README.md#ajouter-une-question-de-quiz). En résumé :

- recettes : schéma Zod, correspondance Ciqual dans `data/ciqual/ingredients.json`,
  `npm run nutrition:write` (jamais de valeurs nutritionnelles saisies à la main), allergènes
  déclarés au moindre doute, étiquettes `alcool` et `cru` quand c'est le cas ;
- quiz : faits vérifiés et sans ambiguïté, 4 choix distincts, explication courte, et si
  possible une source dans la description de la pull request ;
- ton chaleureux, tutoiement, pas de vocabulaire culpabilisant ni de promesse de santé.

## Signaler un problème de sécurité ou de santé

Une allergie ignorée, un garde-fou contourné ou un conseil potentiellement dangereux sont
prioritaires : ouvre une issue avec le modèle « Bug » en le précisant dans le titre. Pour une
faille de sécurité, utilise plutôt
[le signalement privé de GitHub](https://github.com/lMcfly/nutry/security/advisories/new).

## Licence

En contribuant, tu acceptes que ta contribution soit distribuée sous la [licence MIT](LICENSE)
du projet.
