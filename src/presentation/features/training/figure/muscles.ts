/**
 * Groupes musculaires surlignables et leur emplacement sur les segments du mannequin.
 * Les identifiants reprennent ceux du catalogue d'exercices (`primaryMuscles`).
 */
export const FIGURE_MUSCLES = [
  'pectoraux',
  'dos',
  'epaules',
  'biceps',
  'triceps',
  'abdominaux',
  'lombaires',
  'fessiers',
  'quadriceps',
  'ischio-jambiers',
  'mollets',
] as const;
export type FigureMuscle = (typeof FIGURE_MUSCLES)[number];

export type SegmentPart = 'torso' | 'thigh' | 'shin' | 'upperArm' | 'forearm';

export interface MuscleRegion {
  readonly part: SegmentPart;
  readonly from: number;
  readonly to: number;
  /** Côté du segment (vue de profil) ; en vue de face, toute la largeur. */
  readonly side: 'front' | 'back' | 'all';
}

export const MUSCLE_REGIONS: Readonly<Record<FigureMuscle, readonly MuscleRegion[]>> = {
  pectoraux: [{ part: 'torso', from: 0.6, to: 0.92, side: 'front' }],
  dos: [{ part: 'torso', from: 0.45, to: 0.98, side: 'back' }],
  epaules: [{ part: 'upperArm', from: -0.05, to: 0.38, side: 'all' }],
  biceps: [{ part: 'upperArm', from: 0.22, to: 0.92, side: 'front' }],
  triceps: [{ part: 'upperArm', from: 0.18, to: 0.92, side: 'back' }],
  abdominaux: [{ part: 'torso', from: 0.12, to: 0.62, side: 'front' }],
  lombaires: [{ part: 'torso', from: 0.12, to: 0.5, side: 'back' }],
  fessiers: [
    { part: 'torso', from: -0.16, to: 0.24, side: 'back' },
    { part: 'thigh', from: -0.05, to: 0.25, side: 'back' },
  ],
  quadriceps: [{ part: 'thigh', from: 0.08, to: 0.9, side: 'front' }],
  'ischio-jambiers': [{ part: 'thigh', from: 0.18, to: 0.92, side: 'back' }],
  mollets: [{ part: 'shin', from: 0.06, to: 0.62, side: 'back' }],
};

export const MUSCLE_LABELS: Readonly<Record<FigureMuscle, string>> = {
  pectoraux: 'pectoraux',
  dos: 'dos',
  epaules: 'épaules',
  biceps: 'biceps',
  triceps: 'triceps',
  abdominaux: 'abdominaux',
  lombaires: 'lombaires',
  fessiers: 'fessiers',
  quadriceps: 'quadriceps',
  'ischio-jambiers': 'ischio-jambiers',
  mollets: 'mollets',
};
