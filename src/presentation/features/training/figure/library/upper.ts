/** Haut du corps : poussées, tirages, bras. */
import { mat, pullupFrame } from './scene';
import { jointOf, move } from './build';
import { ANKLE_Y, PALM_Y, ground, on, pose, pt } from './pose';
import { tune } from './tune';
import type { MovementFactory } from './types';

const feet = on('ankleL', 0, ANKLE_Y);

/** Pompe : corps gainé de la tête aux talons, mains sous les épaules. */
function pushupKeys(base: (trunk: number) => ReturnType<typeof pose>, upHeight: number) {
  const topTrunk = tune((t) => jointOf(base(t), 'shoulderL').y, upHeight, 30, 89);
  const top = base(topTrunk);
  const shoulder = jointOf(top, 'shoulderL');
  const hands = { handL: pt(shoulder.x + 7, PALM_Y), handR: pt(shoulder.x + 7, PALM_Y) };
  const downTrunk = tune((t) => jointOf(base(t), 'shoulderL').y, 34, 30, 89);
  return [
    { ...top, reach: hands },
    { ...base(downTrunk), reach: hands },
  ];
}

export const UPPER: Record<string, MovementFactory> = {
  pompe: () =>
    move({
      key: 'pompe',
      guides: { path: 'neck', back: true },
      grip: 'paume',
      label: 'Pompe',
      description:
        'Pompe : en planche haute, mains sous les épaules, corps aligné de la tête aux talons, on fléchit les coudes pour descendre la poitrine près du sol, puis on pousse.',
      view: 'profil',
      muscles: ['pectoraux', 'triceps'],
      scene: mat(-10, 140),
      keys: pushupKeys((trunk) => pose({ trunk, ankle: trunk - 78, anchor: on('toeL', 0, 0) }), 60),
      ms: [1200, 1000],
    }),

  'pompe-genoux': () =>
    move({
      key: 'pompe-genoux',
      guides: { path: 'neck', back: true },
      grip: 'paume',
      label: 'Pompe sur les genoux',
      description:
        'Pompe sur les genoux : appui sur les mains et les genoux, buste aligné avec les cuisses, on fléchit les coudes puis on pousse.',
      view: 'profil',
      muscles: ['pectoraux', 'triceps'],
      scene: mat(-50, 110),
      keys: pushupKeys(
        (trunk) => pose({ trunk, knee: 96 - trunk, ankle: -40, anchor: on('kneeL', 0, 5) }),
        60,
      ),
      ms: [1200, 1000],
    }),

  'developpe-epaules': () =>
    move({
      key: 'developpe-epaules',
      guides: { path: 'handL' },
      grip: 'pronation',
      label: 'Développé épaules',
      description:
        'Développé épaules : debout, les haltères à hauteur d’épaules, on pousse les bras au-dessus de la tête sans cambrer, puis on redescend.',
      view: 'face',
      muscles: ['epaules', 'triceps'],
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [
        pose({ hip: 5, shoulder: 92, elbow: 88, anchor: ground(0) }),
        pose({ hip: 5, shoulder: 164, elbow: 14, anchor: ground(0) }),
      ],
      ms: [1100, 1300],
    }),

  'elevation-laterale': () =>
    move({
      key: 'elevation-laterale',
      guides: { path: 'handL' },
      grip: 'pronation',
      label: 'Élévations latérales',
      description:
        'Élévations latérales : debout, coudes légèrement fléchis, on lève les bras sur les côtés jusqu’à hauteur d’épaules, puis on redescend lentement.',
      view: 'face',
      muscles: ['epaules'],
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [
        pose({ hip: 5, shoulder: 9, elbow: 0, anchor: ground(0) }),
        pose({ hip: 5, shoulder: 88, elbow: 0, anchor: ground(0) }),
      ],
      ms: [1100, 1400],
    }),

  'rowing-unilateral': () => {
    // Fente courte, main libre en appui sur la cuisse avant, dos plat.
    const base = {
      trunk: 68,
      hipL: 58,
      kneeL: 14,
      hipR: 100,
      kneeR: 48,
      neck: -24,
      anchor: feet,
    };
    const knee = jointOf(pose(base), 'kneeR');
    const support = pt(knee.x - 6, knee.y + 9);
    return move({
      key: 'rowing-unilateral',
      guides: { path: 'handL', back: true },
      grip: { L: 'neutre', R: 'plat' },
      label: 'Rowing un bras',
      description:
        'Rowing un bras : buste penché dos plat, une main en appui sur la cuisse avant, on tire l’haltère vers la hanche, coude près du corps, puis on redescend bras tendu.',
      view: 'profil',
      muscles: ['dos', 'biceps'],
      loads: [{ kind: 'halteres', at: 'handL' }],
      keys: [
        pose({ ...base, shoulderL: 70, elbowL: 4, reach: { handR: support } }),
        pose({ ...base, shoulderL: -26, elbowL: 100, reach: { handR: support } }),
      ],
      ms: [1000, 1300],
      holds: [300, 400],
    });
  },

  traction: () => {
    const barY = 214;
    const grip = { handL: pt(27, barY), handR: pt(-27, barY) };
    const hang = { hip: 1, knee: 2 };
    return move({
      key: 'traction',
      guides: { path: 'neck' },
      grip: 'pronation',
      label: 'Traction',
      description:
        'Traction : suspendu à la barre bras tendus, mains un peu plus larges que les épaules, on tire les coudes vers les côtes jusqu’à passer le menton au-dessus de la barre, puis on redescend.',
      view: 'face',
      muscles: ['dos', 'biceps'],
      scene: pullupFrame(barY, 50),
      keys: [
        pose({ ...hang, anchor: on('pelvis', 0, barY - 103), reach: grip }),
        pose({ ...hang, neck: -6, anchor: on('pelvis', 0, barY - 60), reach: grip }),
      ],
      ms: [1300, 1300],
      holds: [400, 450],
    });
  },

  curl: () =>
    move({
      key: 'curl',
      guides: { path: 'handL' },
      grip: 'supination',
      label: 'Curl biceps',
      description:
        'Curl biceps : debout, coudes collés au corps, on fléchit les avant-bras pour monter les haltères vers les épaules, puis on redescend lentement.',
      view: 'profil',
      muscles: ['biceps'],
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [
        pose({ shoulder: 2, elbow: 8, anchor: feet }),
        pose({ shoulder: 12, elbow: 142, anchor: feet }),
      ],
      ms: [1000, 1400],
    }),
};
