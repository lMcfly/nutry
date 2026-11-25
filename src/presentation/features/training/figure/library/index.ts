/**
 * Bibliothèque des mouvements illustrés.
 *
 * - `MOVEMENTS` : un dessin par mouvement distinct (fabrique qui reçoit la variante).
 * - `ALIASES` : clés du catalogue qui réutilisent un dessin à une variante près (prise,
 *   inclinaison, côté). Chaque clé de `exercises.json` (champ `movement`) doit être résolue.
 *
 * Ajouter un mouvement : écrire sa fabrique dans le fichier de sa famille (poses de départ et
 * d'arrivée, vue, muscles, matériel), ou une entrée d'alias s'il ne diffère que par une variante.
 */
import { CORE } from './core';
import { CORE2 } from './core2';
import { LEGS } from './legs';
import { LEGS2 } from './legs2';
import { MACHINES } from './machines';
import { MOBILITY } from './mobility';
import { UPPER } from './upper';
import { UPPER2 } from './upper2';
import type { Alias, MovementDef, MovementFactory, Variant } from './types';

export type { Alias, MovementDef, Variant } from './types';

export const MOVEMENTS: Readonly<Record<string, MovementFactory>> = {
  ...LEGS,
  ...LEGS2,
  ...UPPER,
  ...UPPER2,
  ...CORE,
  ...CORE2,
  ...MOBILITY,
  ...MACHINES,
};

export const ALIASES: Readonly<Record<string, Alias>> = {
  'pompe-serree': {
    base: 'pompe',
    label: 'Pompe prise serrée',
    description:
      'Pompe prise serrée : mains rapprochées sous la poitrine, coudes le long du corps, corps aligné, on fléchit les coudes vers l’arrière puis on pousse.',
  },
  'traction-supination': {
    base: 'traction',
    label: 'Traction en supination',
    description:
      'Traction en supination : suspendu à la barre paumes tournées vers soi, mains à largeur d’épaules, on tire jusqu’au menton au-dessus de la barre, puis on redescend.',
  },
  'developpe-incline': {
    base: 'developpe-couche',
    variant: { incline: 30 },
    label: 'Développé incliné',
    description:
      'Développé incliné : dos sur le banc incliné à 30°, pieds au sol, on descend la barre vers le haut de la poitrine puis on pousse vers le haut.',
  },
  'superman-genoux': {
    base: 'bird-dog',
    label: 'Superman à quatre pattes',
    description:
      'Superman à quatre pattes : dos plat, on lève ensemble un bras devant et la jambe opposée derrière, à l’horizontale, puis on revient.',
  },
  'tirage-vertical-machine': {
    base: 'tirage-vertical',
    label: 'Tirage vertical à la machine',
    description:
      'Tirage vertical à la machine : assis, cuisses calées, mains aux poignées hautes, on tire vers le haut de la poitrine en abaissant les coudes, puis on remonte.',
  },
  'hip-thrust-machine': {
    base: 'hip-thrust',
    label: 'Hip thrust à la machine',
    description:
      'Hip thrust à la machine : haut du dos contre l’appui, charge sur les hanches, on pousse le bassin vers le haut jusqu’à l’horizontale, puis on redescend.',
  },
  'mobilite-hanches': {
    base: 'etirement-flechisseurs',
    label: 'Mobilité des hanches',
    description:
      'Mobilité des hanches : en fente basse, genou arrière au sol, on avance doucement le bassin, buste droit, et on respire.',
  },
  'mobilite-epaules': {
    base: 'cercles-bras',
    label: 'Mobilité des épaules',
    description:
      'Mobilité des épaules : bras tendus sur les côtés, on trace de petits cercles dans un sens puis dans l’autre.',
  },
};

/** Toutes les clés reconnues (dessins et alias). */
export function movementKeys(): string[] {
  return [...Object.keys(MOVEMENTS), ...Object.keys(ALIASES)];
}

/** Clés des dessins distincts. */
export function distinctMovementKeys(): string[] {
  return Object.keys(MOVEMENTS);
}

export function hasMovement(key: string): boolean {
  return key in MOVEMENTS || key in ALIASES;
}

/** Dessin d'un mouvement (ou d'un alias), avec sa variante. `undefined` si la clé est inconnue. */
export function resolveMovement(key: string, variant: Variant = {}): MovementDef | undefined {
  const alias = ALIASES[key];
  const factory = MOVEMENTS[alias ? alias.base : key];
  if (!factory) return undefined;
  const merged: Variant = { ...alias?.variant, ...variant };
  const base = factory(merged);
  const def: MovementDef = alias
    ? { ...base, key, label: alias.label, description: alias.description }
    : base;
  // Côté droit : la même image, vue en miroir (le membre qui travaille reste au premier plan).
  return merged.side === 'droite' ? { ...def, mirrored: true } : def;
}
