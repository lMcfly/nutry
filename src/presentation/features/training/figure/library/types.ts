import type { Load, SceneItem } from '../equipment';
import type { FigureMuscle } from '../muscles';
import type { JointName, View } from '../rig';
import type { Timeline } from '../timeline';

/** Mouvement illustré : poses clés, tempo, vue, muscles et matériel par défaut. */
export interface MovementDef {
  readonly key: string;
  /** Nom court, ex. « Squat ». */
  readonly label: string;
  /** Ce que montre l'animation, pour les lecteurs d'écran. */
  readonly description: string;
  readonly view: View;
  readonly timeline: Timeline;
  /** Indice de la pose d'arrivée (dernière pose par défaut). */
  readonly endIndex?: number;
  readonly muscles: readonly FigureMuscle[];
  readonly scene?: readonly SceneItem[];
  readonly loads?: readonly Load[];
  /** Repères : trajectoire d'une articulation (flèche) et ligne « dos droit ». */
  readonly guides?: {
    readonly path?: JointName;
    readonly back?: boolean;
  };
  /** Image retournée horizontalement (côté droit d'un exercice unilatéral). */
  readonly mirrored?: boolean;
}

/** Paramètres de variante : matériel, côté de travail, inclinaison du banc. */
export interface Variant {
  readonly side?: 'gauche' | 'droite';
  /** Inclinaison du dossier (degrés) pour les mouvements sur banc. */
  readonly incline?: number;
}

export type MovementFactory = (variant: Variant) => MovementDef;

/** Clé du catalogue qui réutilise un dessin existant, à une variante près. */
export interface Alias {
  readonly base: string;
  readonly variant?: Variant;
  /** Nom et description propres à la variante. */
  readonly label: string;
  readonly description: string;
}
