# ADR 0002 — Stockage 100 % local avec Dexie (IndexedDB)

- Statut : accepté
- Date : 2026-11-23

## Contexte

Aucun compte, aucun serveur : profil, menus, notes, quiz, progrès et listes de courses restent
sur l'appareil, hors ligne. Il faut aussi exporter / importer / effacer toutes les données.

## Décision

IndexedDB via **Dexie 4**, encapsulé dans `src/infrastructure/db/` derrière les ports
`*Repository` de `application/ports` (méthodes `async`).

- Dexie plutôt que `idb` : schéma versionné déclaratif (`db.version(n).stores()`), migrations
  intégrées, transactions multi-tables simples, ce qui sert l'export/import JSON.
- Le catalogue de recettes et la banque de quiz ne sont pas en base : JSON embarqués au build
  (`src/infrastructure/data/`) et servis par des repositories en lecture seule.
- `localStorage` est exclu (synchrone, quota faible, pas de transactions).

## Conséquences

- Les tests d'infrastructure IndexedDB utilisent `fake-indexeddb` (ajouté en phase 4).
- Chaque évolution du schéma Dexie passe par une nouvelle entrée de `DB_VERSIONS`
  (`src/infrastructure/db/schema.ts`) avec migration : voir ADR 0008.
- Les catalogues JSON sont chargés par import dynamique (morceau séparé du bundle) et
  validés par Zod au premier usage.
