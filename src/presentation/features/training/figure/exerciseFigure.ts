/**
 * Du catalogue au mannequin : le matériel dessiné est celui de l'exercice, pas celui de la pose
 * générique qu'il partage avec d'autres. Ce fichier est la table d'équivalences explicite entre
 * le matériel du catalogue (`Exercise.equipment`) et ce que dessine le mannequin :
 *
 * - chaque matériel du catalogue a son dessin (`CATALOGUE_DRAWING`) ;
 * - les accessoires du foyer que le catalogue ne liste pas (mur, chaise, table, serviette, sac à
 *   dos, bouteilles, sliders, coussin, marche…) sont déclarés par exercice (`EXERCISE_FIGURES`) ;
 * - quand le même geste se fait avec un autre objet, `equipmentOverride` dit lequel (charge
 *   tenue, montage, prise) ; quand la position diffère vraiment, l'exercice a sa pose dédiée
 *   (clé `movement` propre dans le catalogue).
 *
 * `figure.equipment.test` vérifie, pour chacun des exercices du catalogue, que le matériel
 * dessiné est exactement celui-ci.
 */
import type { Exercise } from '@domain/training';
import type { EquipmentKind } from './equipment';
import type { EquipmentOverride, Variant } from './library';

/** Dessin de chaque matériel du catalogue. Tous ont leur dessin propre. */
export const CATALOGUE_DRAWING: Readonly<Record<Exercise['equipment'][number], EquipmentKind>> = {
  tapis: 'tapis',
  halteres: 'halteres',
  elastique: 'elastique',
  kettlebell: 'kettlebell',
  barre: 'barre',
  'barre-ez': 'barre-ez',
  banc: 'banc',
  'banc-incline': 'banc-incline',
  'barre-traction': 'barre-traction',
  poulie: 'poulie',
  'swiss-ball': 'swiss-ball',
  machine: 'machine',
};

/**
 * Matériel dessiné quand le catalogue n'a pas de dessin à lui : l'équivalent le plus proche, dit
 * ici (et non deviné). Les types de la colonne de gauche n'existent pas dans le catalogue.
 */
export const DRAWING_EQUIVALENCE: Readonly<Record<string, EquipmentKind>> = {
  // Cadre de porte : le montant se dessine comme un pan de mur.
  porte: 'mur',
  // Meuble lourd qui cale les chevilles (nordic curl) : dessiné comme une table.
  meuble: 'table',
  // Canapé, rebord : appui ferme, dessiné comme une table.
  canape: 'table',
};

interface ExerciseFigureEntry {
  /** Accessoires du foyer (ou appui) absents de `Exercise.equipment`. */
  readonly extra?: readonly EquipmentKind[];
  readonly override?: EquipmentOverride;
}

const held = (kind: Extract<EquipmentOverride['load'], string>): EquipmentOverride => ({
  load: kind,
});

export const EXERCISE_FIGURES: Readonly<Record<string, ExerciseFigureEntry>> = {
  // Poussées
  'pompes-murales': { extra: ['mur'] },
  'pompes-inclinees': { extra: ['table'], override: { rig: 'table' } },
  'pompes-declinees': { extra: ['chaise'], override: { rig: 'chaise' } },
  'pompes-elastique': { override: { rig: 'elastique-dos' } },
  'developpe-couche-halteres': { override: held('halteres') },
  'developpe-incline-halteres': { override: held('halteres') },
  'developpe-militaire-barre': { override: held('barre') },
  'extension-triceps-mur': { extra: ['mur'] },
  'extension-triceps-table': { extra: ['table'] },
  'extension-triceps-elastique': { override: { rig: 'elastique-ancre-haut' } },
  'dips-chaise': { extra: ['chaise'] },
  'wall-angels': { extra: ['mur'] },
  // Tirages
  'rowing-sac-a-dos': {
    extra: ['sac-a-dos', 'chaise'],
    override: { load: { kind: 'sac-a-dos', at: 'handL' }, rig: 'chaise' },
  },
  'rowing-penche-sac-a-dos': { extra: ['sac-a-dos'], override: held('sac-a-dos') },
  'tirage-poulie-basse': { override: { rig: 'poulie-basse' } },
  'tractions-assistees': { override: { rig: 'elastique-assistance' } },
  'tirage-serviette-vertical': { extra: ['serviette', 'chaise'] },
  // Bras
  'curl-biceps-poids-du-corps': { extra: ['table'] },
  'curl-bouteilles': { extra: ['bouteilles'], override: held('bouteilles') },
  'curl-marteau': { override: { grip: 'neutre' } },
  'curl-elastique': { override: { load: null, rig: 'elastique-pieds' } },
  'curl-barre': { override: held('barre') },
  'curl-barre-ez': { override: held('barre-ez') },
  'curl-poulie-basse': { override: { load: null, rig: 'poulie-basse' } },
  'elevation-frontale-poulie': { override: { rig: 'poulie-dos' } },
  'pallof-press': { override: { rig: 'elastique-ancre' } },
  // Jambes
  'squat-chaise': { extra: ['chaise'] },
  'squat-bulgare': { extra: ['chaise'], override: { load: null, rig: 'chaise' } },
  'squat-bulgare-halteres': { extra: ['banc'] },
  'step-up': { extra: ['step'] },
  'goblet-squat': { override: { load: { kind: 'halteres', at: 'chest' } } },
  'squat-barre': {
    override: { load: { kind: 'barre', at: 'back' }, rig: 'barre-dos' },
  },
  'fentes-barre': {
    override: { load: { kind: 'barre', at: 'back' }, rig: 'barre-dos' },
  },
  'fente-arriere-halteres': { override: held('halteres') },
  'fentes-marchees-halteres': { override: held('halteres') },
  'hip-thrust-halteres': { extra: ['banc'], override: { load: { kind: 'halteres', at: 'hips' } } },
  'bonjour-halteres': {
    override: { load: { kind: 'halteres', at: 'chest' }, rig: 'poitrine' },
  },
  'good-morning-elastique': { override: { load: null, rig: 'elastique-pieds' } },
  'charniere-hanche-mur': { extra: ['mur'], override: { load: null, rig: ['mur', 'poitrine'] } },
  'souleve-de-terre-une-jambe-haltere': {
    override: { load: { kind: 'halteres', at: 'handL' } },
  },
  'souleve-de-terre-roumain-halteres': { override: held('halteres') },
  'nordic-curl': { extra: ['table'] },
  'curl-ischio-sliders': { extra: ['sliders'] },
  'mollets-debout-poids-du-corps': { extra: ['mur'], override: { rig: 'mur' } },
  'mollets-haltere': { override: held('halteres') },
  'mollets-debout-barre': {
    extra: ['step'],
    override: { load: { kind: 'barre', at: 'back' }, rig: ['barre-dos', 'marche'] },
  },
  'mollets-marche-halteres': { override: { load: 'halteres', rig: 'banc-bas' } },
  'mollets-assis-halteres': { extra: ['banc'] },
  'equilibre-une-jambe-coussin': { extra: ['coussin'], override: { rig: 'coussin' } },
  // Abdominaux
  'crunch-lest-halteres': {
    override: { load: { kind: 'halteres', at: 'chest' }, rig: 'poitrine' },
  },
  // Étirements
  'etirement-mollets': { extra: ['mur'] },
  'etirement-pectoraux-porte': { extra: ['mur'] },
};

export interface FigureSpec {
  readonly movement: string;
  /** Matériel de l'exercice : ce que le mannequin dessine, rien d'autre. */
  readonly equipment: readonly EquipmentKind[];
  readonly variant: Variant;
}

/** Matériel dessiné d'un exercice : celui du catalogue (dessiné) plus ses accessoires du foyer. */
export function figureEquipmentOf(
  exercise: Pick<Exercise, 'id' | 'equipment'>,
): readonly EquipmentKind[] {
  const extra = EXERCISE_FIGURES[exercise.id]?.extra ?? [];
  return [...new Set([...exercise.equipment.map((e) => CATALOGUE_DRAWING[e]), ...extra])];
}

/** Tout ce qu'il faut au mannequin pour montrer exactement cet exercice. */
export function figureOf(exercise: Pick<Exercise, 'id' | 'movement' | 'equipment'>): FigureSpec {
  const override = EXERCISE_FIGURES[exercise.id]?.override;
  return {
    movement: exercise.movement,
    equipment: figureEquipmentOf(exercise),
    variant: override ? { equipmentOverride: override } : {},
  };
}
