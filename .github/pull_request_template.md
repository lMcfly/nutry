## Ce que change cette pull request

<!-- En une ou deux phrases. Lien vers l'issue : « Ferme #123 ». -->

## Type de changement

- [ ] Correction de bug
- [ ] Nouvelle fonctionnalité
- [ ] Contenu (recettes, quiz)
- [ ] Documentation, CI, outillage

## Vérifications

- [ ] `npm run lint`, `npm run typecheck` et `npm run format:check` passent
- [ ] `npm run test:coverage` passe (≥ 90 % sur `domain` et `application`)
- [ ] `npm run e2e` passe si l'interface, la PWA ou le build changent
- [ ] Les règles de dépendance entre couches sont respectées (aucun import interdit)
- [ ] Une décision d'architecture nouvelle est décrite dans un ADR

## Contenu (si applicable)

- [ ] Nutrition recalculée avec `npm run nutrition:write` (aucune valeur saisie à la main)
- [ ] Allergènes déclarés au moindre doute, étiquettes `alcool` et `cru` vérifiées
- [ ] Faits du quiz vérifiés (sources indiquées ci-dessous)

## Interface (si applicable)

- [ ] Testée sur mobile, en thème clair et sombre
- [ ] Accessible au clavier et au lecteur d'écran, textes au tutoiement et bienveillants
- [ ] Captures avant / après ajoutées ci-dessous
