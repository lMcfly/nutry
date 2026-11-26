import type { EquipmentKind, Load, LoadKind, SceneItem } from '../equipment';
import type { FigureMuscle } from '../muscles';
import type { Grip, JointName, View } from '../rig';
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

/**
 * Montage particulier d'une pose, interprété par la fabrique du mouvement (le même geste avec un
 * autre support) : appui sur une table, une chaise ou une marche, élastique ancré ou aux pieds,
 * poulie, mur, coussin, sliders…
 */
export type Rig =
  | 'table'
  | 'chaise'
  | 'marche'
  | 'mur'
  | 'coussin'
  | 'sliders'
  | 'elastique-dos'
  | 'elastique-pieds'
  | 'elastique-ancre'
  | 'elastique-ancre-haut'
  | 'elastique-assistance'
  | 'poulie-basse'
  | 'poulie-dos'
  | 'machine'
  | 'banc-bas'
  | 'barre-dos'
  | 'poitrine';

/**
 * Matériel réellement utilisé par l'exercice quand il diffère de celui de la pose générique :
 * charge tenue (remplace celle de la pose ; `null` : aucune) et montage.
 */
export interface EquipmentOverride {
  /**
   * Un type de charge garde l'emplacement de celle de la pose (même position, autre objet :
   * barre → haltères, haltères → bouteilles…) ; une charge complète choisit aussi où elle est
   * tenue ; `null` : aucune charge.
   */
  readonly load?: Load | LoadKind | null;
  readonly rig?: Rig | readonly Rig[];
  /** Prise imposée (marteau, supination…). */
  readonly grip?: Grip;
}

/** Paramètres de variante : matériel, côté de travail, inclinaison du banc. */
export interface Variant {
  readonly equipmentOverride?: EquipmentOverride;
  /** Matériel de l'exercice : seules ces pièces de décor et ces charges sont dessinées. */
  readonly equipment?: readonly EquipmentKind[];
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
