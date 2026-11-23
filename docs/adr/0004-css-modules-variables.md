# ADR 0004 — CSS Modules et variables CSS (thème clair/sombre)

- Statut : accepté
- Date : 2026-11-23

## Contexte

Il faut un style mobile-first, un thème clair/sombre et un bundle léger, sans dépendance
supplémentaire.

## Décision

- **CSS Modules** (`*.module.css`, pris en charge nativement par Vite) pour la portée locale des
  styles de chaque composant.
- **Variables CSS** (jetons) dans `src/presentation/theme/tokens.css` : couleurs, espacements,
  typographie. Le thème sombre suit `prefers-color-scheme` et peut être forcé via
  `<html data-theme="light|dark">`.
- Tailwind écarté : outillage en plus, et des classes utilitaires moins lisibles pour un design
  system restreint.

## Conséquences

- Phase 1 : jetons minimaux ; l'agent ui-ux les complète en phase 5 (contrastes AA, tailles
  tactiles ≥ 48 px).
- Les composants n'utilisent jamais de couleur en dur : toujours une variable.
