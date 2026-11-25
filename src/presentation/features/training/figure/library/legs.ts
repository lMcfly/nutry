/** Jambes et fessiers : squats, fentes, charnières de hanche, ponts. */
import { bench, box, chair, mat, wall } from './scene';
import { move, jointOf } from './build';
import { ANKLE_Y, on, pose, pt } from './pose';
import { tune } from './tune';
import type { MovementFactory } from './types';

const standing = (extra: Parameters<typeof pose>[0]) => pose({ shoulder: 4, ...extra });
const feet = on('ankleL', 0, ANKLE_Y);

/** Squat poids du corps : bras devant pour l'équilibre, dos droit, cuisses à l'horizontale. */
const squatTop = standing({ anchor: feet, shoulder: 12, elbow: 10 });
const squatBottom = pose({
  trunk: 36,
  hip: 118,
  knee: 116,
  shoulder: 122,
  elbow: 6,
  neck: -16,
  anchor: feet,
});

export const LEGS: Record<string, MovementFactory> = {
  squat: () =>
    move({
      key: 'squat',
      guides: { path: 'pelvis', back: true },
      label: 'Squat',
      description:
        'Squat : debout, pieds à plat, on descend les hanches en arrière jusqu’aux cuisses à l’horizontale, dos droit et genoux dans l’axe des pieds, puis on remonte.',
      view: 'profil',
      muscles: ['quadriceps', 'fessiers'],
      keys: [squatTop, squatBottom],
      ms: [1300, 1100],
    }),

  'squat-goblet': () => {
    const arms = { shoulder: 18, elbow: 146 };
    return move({
      key: 'squat-goblet',
      guides: { path: 'pelvis', back: true },
      grip: 'neutre',
      label: 'Squat goblet',
      description:
        'Squat goblet : une charge tenue contre la poitrine, coudes serrés, on descend les hanches entre les talons, buste droit, puis on remonte.',
      view: 'profil',
      muscles: ['quadriceps', 'fessiers'],
      loads: [{ kind: 'kettlebell', at: 'chest' }],
      keys: [
        pose({ ...arms, anchor: feet }),
        pose({ trunk: 28, hip: 118, knee: 122, neck: -12, ...arms, anchor: feet }),
      ],
      ms: [1300, 1100],
    });
  },

  'squat-avant': () =>
    move({
      key: 'squat-avant',
      guides: { path: 'pelvis', back: true },
      grip: 'pronation',
      label: 'Squat avant',
      description:
        'Squat avant : la barre repose sur l’avant des épaules, coudes hauts, buste presque vertical, on descend puis on remonte.',
      view: 'profil',
      muscles: ['quadriceps', 'fessiers'],
      loads: [{ kind: 'barre', at: 'front' }],
      keys: [
        pose({ shoulder: 95, elbow: 150, anchor: feet }),
        pose({ trunk: 22, hip: 112, knee: 124, shoulder: 75, elbow: 150, neck: -8, anchor: feet }),
      ],
      ms: [1300, 1100],
    }),

  'squat-chaise': () => {
    const bottom = pose({
      trunk: 34,
      hip: 104,
      knee: 98,
      shoulder: 120,
      elbow: 6,
      neck: -14,
      anchor: feet,
    });
    const pelvis = jointOf(bottom, 'pelvis');
    return move({
      key: 'squat-chaise',
      guides: { path: 'pelvis', back: true },
      label: 'Squat à la chaise',
      description:
        'Squat à la chaise : on descend les fesses jusqu’à effleurer l’assise, bras tendus devant, puis on remonte sans s’asseoir.',
      view: 'profil',
      muscles: ['quadriceps', 'fessiers'],
      scene: chair(pelvis.x - 30, pelvis.x + 6, pelvis.y - 11, -1),
      keys: [pose({ shoulder: 12, anchor: feet }), bottom],
      ms: [1300, 1100],
    });
  },

  'fente-avant': () => {
    // Le pied arrière reste planté (il passe sur la pointe) ; la jambe avant fait le pas.
    const start = standing({ anchor: on('ankleR', -30, ANKLE_Y) });
    const end = pose({
      shoulder: 6,
      anchor: on('pelvis', 4, 50),
      reach: { ankleL: pt(40, ANKLE_Y), ankleR: pt(-31, 13) },
      feet: { L: 'flat', R: 'toes' },
    });
    return move({
      key: 'fente-avant',
      guides: { path: 'pelvis' },
      label: 'Fente avant',
      description:
        'Fente avant : un grand pas en avant, les deux genoux fléchissent à angle droit, le genou avant reste au-dessus de la cheville, buste droit, puis retour.',
      view: 'profil',
      muscles: ['quadriceps', 'fessiers'],
      keys: [start, end],
      ms: [1200, 1100],
    });
  },

  'fente-arriere': () => {
    const start = standing({ anchor: feet });
    const end = pose({
      hipL: 84,
      kneeL: 88,
      shoulder: 6,
      anchor: feet,
      reach: { ankleR: pt(-70, 13) },
      feet: { L: 'flat', R: 'toes' },
    });
    return move({
      key: 'fente-arriere',
      guides: { path: 'pelvis' },
      label: 'Fente arrière',
      description:
        'Fente arrière : une jambe recule, le genou arrière descend vers le sol, le genou avant reste au-dessus de la cheville, puis on revient debout.',
      view: 'profil',
      muscles: ['quadriceps', 'fessiers'],
      keys: [start, end],
      ms: [1200, 1100],
    });
  },

  'pont-fessier': () => {
    const shoulders = on('neck', -46, 9);
    const heels = { ankleL: pt(26, ANKLE_Y), ankleR: pt(26, ANKLE_Y) };
    const arms = { shoulder: -4, elbow: 0 };
    return move({
      key: 'pont-fessier',
      guides: { path: 'pelvis' },
      grip: 'plat',
      label: 'Pont fessier',
      description:
        'Pont fessier : allongé sur le dos, genoux fléchis et pieds à plat, on soulève le bassin jusqu’à aligner épaules, hanches et genoux, puis on redescend.',
      view: 'profil',
      muscles: ['fessiers', 'ischio-jambiers'],
      scene: mat(-75, 40),
      keys: [
        pose({ trunk: -90, neck: 4, ...arms, anchor: shoulders, reach: heels }),
        pose({ trunk: -118, neck: 30, shoulder: -30, elbow: 0, anchor: shoulders, reach: heels }),
      ],
      ms: [1100, 1200],
      holds: [350, 450],
    });
  },

  'hip-thrust': () => {
    const benchTop = 42;
    const shoulders = on('neck', -40, benchTop + 6);
    const heels = { ankleL: pt(34, ANKLE_Y), ankleR: pt(34, ANKLE_Y) };
    // Les mains tiennent la barre posée sur le pli de la hanche.
    const holding = (trunk: number) => {
      const base = pose({
        trunk,
        neck: 22 + (-52 - trunk) * 0.75,
        anchor: shoulders,
        reach: heels,
      });
      const pelvis = jointOf(base, 'pelvis');
      const rad = (trunk * Math.PI) / 180;
      const bar = pt(pelvis.x + Math.cos(rad) * 13 - 4, pelvis.y - Math.sin(rad) * 13);
      return pose({
        trunk,
        neck: 22 + (-52 - trunk) * 0.75,
        anchor: shoulders,
        reach: { ...heels, handL: bar, handR: bar },
      });
    };
    return move({
      key: 'hip-thrust',
      guides: { path: 'pelvis' },
      grip: 'pronation',
      label: 'Hip thrust',
      description:
        'Hip thrust : le haut du dos appuyé sur un banc, pieds à plat, on pousse le bassin vers le haut jusqu’à l’horizontale, puis on redescend.',
      view: 'profil',
      muscles: ['fessiers', 'ischio-jambiers'],
      scene: bench(-110, -34, benchTop),
      loads: [{ kind: 'barre', at: 'hips' }],
      keys: [holding(-52), holding(-90)],
      ms: [1100, 1200],
      holds: [300, 450],
    });
  },

  'souleve-de-terre': () => {
    // Départ : tibias presque verticaux, hanches nettement au-dessus des genoux, dos plat,
    // épaules au-dessus de la barre, bras tendus ; le disque touche le sol.
    const barY = 19;
    const bar = { handL: pt(7, barY), handR: pt(7, barY) };
    const thigh = 70;
    const shin = -12;
    const setup = (trunk: number) =>
      pose({ trunk, hip: thigh + trunk, knee: thigh - shin, neck: -26, anchor: feet });
    const trunk = tune((t) => jointOf(setup(t), 'shoulderL').y, barY + 56, 30, 89);
    return move({
      key: 'souleve-de-terre',
      label: 'Soulevé de terre',
      description:
        'Soulevé de terre : dos plat, hanches plus hautes que les genoux, tibias presque verticaux, épaules au-dessus de la barre posée au milieu du pied ; on pousse dans le sol et on se redresse jusqu’à la station debout.',
      view: 'profil',
      muscles: ['fessiers', 'ischio-jambiers', 'lombaires'],
      guides: { path: 'handL', back: true },
      grip: 'pronation',
      loads: [{ kind: 'barre', at: 'hands' }],
      keys: [
        pose({
          trunk,
          hip: thigh + trunk,
          knee: thigh - shin,
          neck: -26,
          anchor: feet,
          reach: bar,
        }),
        pose({ trunk: 0, anchor: feet, reach: { handL: pt(8, 80), handR: pt(8, 80) } }),
      ],
      ms: [1300, 1300],
      holds: [450, 350],
    });
  },

  'souleve-de-terre-roumain': () =>
    move({
      key: 'souleve-de-terre-roumain',
      guides: { path: 'handL', back: true },
      grip: 'pronation',
      label: 'Soulevé de terre roumain',
      description:
        'Soulevé de terre roumain : genoux légèrement fléchis, on pousse les hanches en arrière dos plat, la charge glisse le long des jambes jusqu’à mi-tibia, puis on se redresse.',
      view: 'profil',
      muscles: ['ischio-jambiers', 'fessiers'],
      loads: [{ kind: 'barre', at: 'hands' }],
      keys: [
        pose({ anchor: feet, reach: { handL: pt(8, 76), handR: pt(8, 76) } }),
        pose({
          trunk: 72,
          hip: 92,
          knee: 20,
          neck: -30,
          anchor: feet,
          reach: { handL: pt(14, 38), handR: pt(14, 38) },
        }),
      ],
      ms: [1500, 1200],
    }),

  'step-up': () => {
    const stepTop = 36;
    return move({
      key: 'step-up',
      guides: { path: 'pelvis' },
      label: 'Montée sur marche',
      description:
        'Montée sur marche : un pied posé sur la marche, on pousse sur ce talon pour monter debout, puis on redescend en contrôlant.',
      view: 'profil',
      muscles: ['quadriceps', 'fessiers'],
      scene: box(-14, 34, stepTop),
      keys: [
        pose({
          hipL: 70,
          kneeL: 92,
          trunk: 12,
          anchor: on('ankleL', 6, stepTop + ANKLE_Y),
          reach: { ankleR: pt(-38, ANKLE_Y) },
          feet: { L: 'flat', R: 'toes' },
        }),
        pose({
          hipR: 70,
          kneeR: 90,
          ankleR: -20,
          shoulder: 6,
          anchor: on('ankleL', 6, stepTop + ANKLE_Y),
        }),
      ],
      ms: [1200, 1300],
    });
  },

  'mollets-debout': () =>
    move({
      key: 'mollets-debout',
      guides: { path: 'heelL' },
      label: 'Mollets debout',
      description:
        'Extension des mollets debout : jambes tendues, on monte sur la pointe des pieds le plus haut possible, puis on redescend lentement.',
      view: 'profil',
      muscles: ['mollets'],
      keys: [
        pose({ ankle: 0, anchor: on('toeL', 14, 0) }),
        pose({ ankle: -34, anchor: on('toeL', 14, 0) }),
      ],
      ms: [800, 1100],
      holds: [300, 500],
    }),

  'chaise-murale': () => {
    const back = 0;
    return move({
      key: 'chaise-murale',
      guides: { path: 'pelvis', back: true },
      label: 'Chaise contre le mur',
      description:
        'Chaise contre le mur : dos plaqué au mur, on glisse jusqu’aux cuisses à l’horizontale, genoux au-dessus des chevilles, et on tient la position.',
      view: 'profil',
      muscles: ['quadriceps'],
      scene: wall(back - 1, -1),
      keys: [
        pose({
          anchor: on('pelvis', back + 12, 78),
          reach: { ankleL: pt(back + 46, ANKLE_Y), ankleR: pt(back + 46, ANKLE_Y) },
        }),
        pose({
          anchor: on('pelvis', back + 12, 47),
          reach: { ankleL: pt(back + 55, ANKLE_Y), ankleR: pt(back + 55, ANKLE_Y) },
        }),
      ],
      ms: [1400, 1400],
      holds: [300, 1500],
    });
  },
};

// Pièces réservées aux mouvements à venir (évite les imports inutilisés pendant l'écriture).
