# ADR 0007 — Garde-fous de santé complémentaires

- Statut : accepté (validé par l'utilisateur)
- Date : 2026-11-23

## Contexte

La relecture de la phase 2 (ADR 0006) a relevé des situations où le moteur pouvait réduire les
portions ou proposer des plats inadaptés à des personnes vulnérables. L'utilisateur a validé les
règles ci-dessous ; elles complètent les garde-fous de `assessEnergy` (mineur, grossesse ou
allaitement, IMC bas, tour de taille).

## Décision

1. **Grossesse ou allaitement** (sexe « femme » ou « autre ») : exclusion **dure** des recettes
   étiquetées `alcool` ou `cru`. La règle vit dans `isRecipeCompatible`
   (`PREGNANCY_EXCLUDED_TAGS`), donc s'applique au menu, au remplacement et au frigo vide. L'audit
   de contenu (`checkSafetyTags`) signale un ingrédient alcoolisé (vin, bière, cidre…, hors
   vinaigre) sans étiquette `alcool` ; l'étiquette `cru` reste à poser par le contenu.
2. **Personne de 70 ans ou plus** : seuil d'IMC bas à **22** (repère de la HAS) au lieu de 18,5.
   En dessous, la perte est désactivée et un message bienveillant (`imc-bas-senior`, sans
   vocabulaire anxiogène) invite à en parler à son médecin.
3. **Condition de santé** : nouveau champ facultatif `Profile.healthCondition` (trouble du
   comportement alimentaire, diabète, maladie rénale, traitement en cours…). S'il vaut `true` :
   aucun déficit, `perteAutorisee = false`, message `condition-sante` invitant à consulter.
4. **Profil protégé** (`EnergyAssessment.protectedProfile`) : moins de 18 ans, grossesse ou
   allaitement, condition de santé, IMC bas (18,5 ou 22 selon l'âge). Pour ces profils,
   `computeUserPortionFactor` renvoie un facteur **≥ 1** et ignore l'ajustement appris
   « trop copieux ». L'alerte de tour de taille seule ne rend pas un profil protégé.
5. **Suivi du poids** : `weightTrackingEnabledByDefault` (et
   `isWeightTrackingEnabledByDefault`) vaut `false` avant 18 ans ou avec une condition de santé,
   `true` sinon. La personne peut l'activer elle-même. Aucun âge minimum n'est bloquant.
6. Les cibles des jauges d'équilibre (PNNS) et les seuils d'audit des recettes (ADR 0006) sont
   validés tels quels.

## Conséquences

- L'application doit utiliser `computeUserPortionFactor(assessEnergy(profile), weights.portionMultiplier)`
  plutôt que `computePortionFactor` pour la liste de courses et l'affichage des portions.
- L'onboarding ajoute la question facultative « As-tu une condition de santé particulière ? ».
- Le contenu doit étiqueter `alcool` et `cru` ; un test de contenu peut s'appuyer sur `auditRecipe`.
