# ADR 0012 — Compagnon Nutry et série

- Statut : accepté
- Date : 2026-11-23

## Contexte

Nutry accompagne la personne par un petit compagnon personnalisable qui récompense la
régularité, sans jamais culpabiliser. Seule la logique est décidée ici (pas d'interface).

## Décision

### Domain (`domain/companion`, fonctions pures)

- **Geste** : un jour compte si la personne répond au quiz, note un repas (👍/👎) ou
  **coche** un article de courses. Ouvrir l'app, décocher, ajouter un article ne comptent pas.
  Les jours sont locaux (`Clock.today()`).
- **Série** : jours consécutifs actifs (`recordActivity`). Même jour : rien ne change. Jour
  manqué : la série repart à 1 au prochain geste ; `currentStreak(state, today)` rend 0 dès
  qu'un jour entier a été manqué. Le **record** (`best`) est conservé.
- **Déblocages sur le record**, jamais sur la série en cours : rien ne se reperd.
  Constantes dans `companion.constants.ts` (`unlockAt`), jours : feuille sur la tête 1,
  lunettes rondes 3, toque de chef 7, écharpe 10, tablier 14, bonnet 21, couronne de fruits
  30 ; teintes spéciales Aurore 5, Cosmos 15, Arc-en-ciel 45. Six teintes et cinq styles
  d'yeux de base disponibles d'emblée.
- **Apparence** : teinte, yeux, au plus un accessoire par emplacement (tête, visage, cou,
  corps ; le type interdit un accessoire au mauvais emplacement). `equip` refuse un élément
  inconnu ou non débloqué.
- **Humeur** : `joyeux` (actif aujourd'hui), `content` (actif hier, ou avant tout geste),
  `sieste` (série interrompue). Jamais « triste ». Messages en tutoiement, dans le domain
  (ADR 0010).
- **Célébration** : `acknowledgedBest` mémorise le record déjà fêté ; les éléments entre
  les deux sont « nouveaux » (`newlyUnlocked`) jusqu'à `acknowledgeUnlocks()`.

### Application

- Port `CompanionRepository` (`get`, `save`) ; cas d'usage `getCompanion`,
  `customizeCompanion`, `acknowledgeUnlocks`.
- `recordCompanionActivity` est appelé **dans** `answerQuiz` (réponse nouvelle seulement),
  `rateMeal` et `toggleShoppingItem` (coche seulement), donc déjà sous le verrou sériel
  (pas de second verrou : interblocage). Au mieux : un échec du compagnon n'annule jamais
  le geste.

### Infrastructure

- Base Dexie v3 : table singleton `companion` (sans ligne : état initial).
- Sauvegarde : `SNAPSHOT_SCHEMA_VERSION` = 3, clé `companion` ; migration v2 → v3 = état
  initial (aucune série reconstituée). Le schéma Zod est aligné sur le domain à la
  compilation et vérifie la cohérence (série ≤ record, jour actif présent dès qu'il y a un
  record, apparence débloquée par le record, pas de jour futur). `clearAll` l'efface.

## Complément (phase 5 du Sport, ADR 0015) : accessoires sportifs

- `unlockAt` devient `{ kind: 'serie', days } | { kind: 'seances', count }` : le record de série
  d'un côté, le nombre cumulé de séances de Sport terminées de l'autre (dérivé des journaux, donc
  rien ne se reperd ; aucun champ de plus dans l'état persisté ni dans la sauvegarde).
- Quatre accessoires : bandeau (tête, 1 séance), serviette (cou, 5), casquette (tête, 10),
  médaille (cou, 20) ; dessins SVG dans le repère de Nutry (`Accessories.tsx`). Les tuples
  d'identifiants gagnent ces quatre valeurs et le schéma Zod suit.
- `isUnlocked`, `unlockedItems` et `equip` reçoivent `sessions` (0 par défaut) ; l'application le
  tire des journaux (`CompanionView.sessionsCompleted`) et la validation d'une sauvegarde le
  compte dans le fichier importé. `nextUnlock` et `newlyUnlockedItems` ne parlent que des séries
  (les accessoires sportifs sont célébrés à la fin de la séance).
- « Personnaliser Nutry » : onglet Sport, bulles verrouillées avec « à N séances ».

## Conséquences

- Changer un seuil ne reperd rien (déblocage = record) mais peut en débloquer de nouveaux.
- Ajouter une option au catalogue : l'id dans le tuple du domain, l'entrée du catalogue
  (un test vérifie leur concordance) ; le schéma Zod suit tout seul.
