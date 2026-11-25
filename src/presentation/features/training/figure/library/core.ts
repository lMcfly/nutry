/** Gainage, abdominaux et cardio. */
import { mat } from './scene';
import { jointOf, move } from './build';
import { ANKLE_Y, PALM_Y, ground, on, pose, pt } from './pose';
import type { PoseSpec } from './pose';
import { solvePose } from '../rig';
import type { View } from '../rig';
import { tune } from './tune';
import type { MovementFactory } from './types';

/** Planche haute (bras tendus) : mains au sol, tronc calé pour que les pointes touchent le sol. */
function highPlank() {
  const make = (trunk: number, legs: Partial<Record<string, number>> = {}) =>
    pose({
      trunk,
      shoulder: trunk,
      elbow: 0,
      ankle: trunk - 78,
      ...legs,
      anchor: on('handL', 0, PALM_Y),
    });
  const trunk = tune((t) => jointOf(make(t), 'toeL').y, 0, 40, 89);
  return { trunk, make };
}

/** Mains croisées derrière la nuque, coudes ouverts. */
export function handsBehindHead(spec: PoseSpec, view: View = 'profil') {
  const sk = solvePose(pose(spec), view);
  const th = (sk.headTilt * Math.PI) / 180;
  const up = { x: Math.sin(th), y: Math.cos(th) };
  const front = { x: Math.cos(th), y: -Math.sin(th) };
  const head = sk.joints.head;
  const nape = pt(head.x - front.x * 9 - up.x * 3, head.y - front.y * 9 - up.y * 3);
  return pose({ ...spec, grip: 'nuque', reach: { ...spec.reach, handL: nape, handR: nape } });
}

export const CORE: Record<string, MovementFactory> = {
  planche: () => {
    const knees = (trunk: number) =>
      pose({
        trunk,
        shoulder: trunk,
        elbow: 90,
        hip: 8,
        knee: 96 - trunk,
        ankle: -72,
        anchor: on('kneeL', 0, 5),
      });
    const kneeTrunk = tune((t) => jointOf(knees(t), 'elbowL').y, 4.5, 40, 89);
    const kneePose = knees(kneeTrunk);
    const elbow = jointOf(kneePose, 'elbowL');
    const full = (trunk: number) =>
      pose({
        trunk,
        shoulder: trunk,
        elbow: 90,
        ankle: trunk - 80,
        anchor: on('elbowL', elbow.x, 4.5),
      });
    const fullTrunk = tune((t) => jointOf(full(t), 'toeL').y, 0, 50, 89);
    return move({
      key: 'planche',
      guides: { back: true },
      grip: 'plat',
      label: 'Gainage planche',
      description:
        'Gainage planche : en appui sur les avant-bras et la pointe des pieds, coudes sous les épaules, corps aligné de la tête aux talons, on tient la position.',
      view: 'profil',
      muscles: ['abdominaux', 'epaules'],
      scene: mat(elbow.x - 150, elbow.x + 40),
      keys: [kneePose, full(fullTrunk)],
      ms: [1400, 1400],
      holds: [500, 2000],
    });
  },

  crunch: () => {
    const legs = { ankleL: pt(44, ANKLE_Y), ankleR: pt(44, ANKLE_Y) };
    const hips = on('pelvis', 0, 10);
    return move({
      key: 'crunch',
      guides: { path: 'neck' },
      grip: 'nuque',
      label: 'Crunch',
      description:
        'Crunch : allongé sur le dos, genoux fléchis, on enroule le haut du dos vers les genoux en expirant, le bas du dos reste au sol, puis on redescend.',
      view: 'profil',
      muscles: ['abdominaux'],
      scene: mat(-70, 64),
      keys: [
        handsBehindHead({ trunk: -90, neck: 6, anchor: hips, reach: legs }),
        handsBehindHead({ trunk: -86, spine: 34, neck: 22, anchor: hips, reach: legs }),
      ],
      ms: [1000, 1200],
      holds: [300, 450],
    });
  },

  'mountain-climber': () => {
    const { trunk, make } = highPlank();
    const tuck = (side: 'L' | 'R') => {
      const bent = { hip: trunk + 70, knee: 138, ankle: -30 };
      return make(trunk, {
        [`hip${side}`]: bent.hip,
        [`knee${side}`]: bent.knee,
        [`ankle${side}`]: bent.ankle,
      });
    };
    return move({
      key: 'mountain-climber',
      guides: { path: 'kneeL', back: true },
      grip: 'paume',
      label: 'Mountain climbers',
      description:
        'Mountain climbers : en planche haute, bras tendus, on ramène un genou vers la poitrine puis l’autre, en alternance rapide, bassin stable.',
      view: 'profil',
      muscles: ['abdominaux', 'quadriceps'],
      scene: mat(-140, 20),
      keys: [tuck('L'), tuck('R')],
      ms: 420,
      holds: [60, 60],
    });
  },

  'jumping-jack': () =>
    move({
      key: 'jumping-jack',
      guides: { path: 'handL' },
      label: 'Jumping jacks',
      description:
        'Jumping jacks : on saute en écartant les pieds et en levant les bras au-dessus de la tête, puis on revient pieds joints, bras le long du corps.',
      view: 'face',
      muscles: ['mollets', 'epaules'],
      keys: [
        pose({ hip: 2, shoulder: 8, elbow: 6, anchor: ground(0) }),
        pose({ hip: 10, shoulder: 96, elbow: 8, ankle: -20, anchor: ground(0, 9) }),
        pose({ hip: 17, shoulder: 168, elbow: 10, anchor: ground(0) }),
      ],
      ms: 330,
      holds: [80, 80],
    }),
};
