/** Jambes et fessiers (suite) : quatre pattes, couché sur le côté, charnières, unilatéral. */
import { band, bench, chair, item, mat, pulley, wall } from './scene';
import { hasRig } from './rigs';
import { jointOf, move } from './build';
import { FEET, offset, prone, quad, supine, torsoFrame } from './helpers';
import { ANKLE_Y, KNEE_Y, ground, on, pose, pt } from './pose';
import type { PoseSpec } from './pose';
import type { MovementFactory } from './types';
import type { Pose } from '../rig';

/** Couché sur le côté droit, vu de face : tête à gauche, jambes vers la droite. */
function sideLying(spec: Partial<PoseSpec> = {}): Pose {
  return pose({
    trunk: -90,
    neck: -8,
    shoulderR: 175,
    elbowR: 40,
    shoulderL: 4,
    elbowL: 4,
    ankle: -6,
    feet: 'free',
    anchor: ground(0),
    grip: { L: 'plat' },
    ...spec,
  });
}

/** Barre posée sur le haut du dos : les mains la tiennent de part et d'autre de la nuque. */
export function barOnBack(spec: PoseSpec): Pose {
  const p = pose(spec);
  const sk = jointOf(p, 'neck');
  const tilt = spec.trunk ?? 0;
  const { up, front } = torsoFrame(tilt + (spec.spine ?? 0));
  const bar = offset(offset(sk, up, -4), front, -11.5);
  const hands = offset(bar, front, 2);
  return pose({ ...spec, reach: { ...spec.reach, handL: hands, handR: hands }, grip: 'pronation' });
}

export const LEGS2: Record<string, MovementFactory> = {
  'quadrupedie-extension': () =>
    move({
      key: 'quadrupedie-extension',
      label: 'Extension de hanche à quatre pattes',
      description:
        'Extension de hanche à quatre pattes : dos plat, on monte une jambe pliée à angle droit, plante du pied vers le plafond, jusqu’à l’horizontale de la cuisse, puis on redescend.',
      view: 'profil',
      muscles: ['fessiers'],
      guides: { path: 'heelR', back: true },
      scene: mat(-60, 90),
      keys: [quad(), quad({ hipR: 0, kneeR: 92, ankleR: 0 })],
      ms: [1000, 1200],
      holds: [300, 500],
    }),

  'kickback-fessier': () =>
    move({
      key: 'kickback-fessier',
      label: 'Kickback fessier',
      description:
        'Kickback fessier : à quatre pattes, on tend une jambe vers l’arrière jusqu’à l’horizontale, pied fléchi, sans creuser le dos, puis on ramène le genou.',
      view: 'profil',
      muscles: ['fessiers', 'ischio-jambiers'],
      guides: { path: 'heelR', back: true },
      scene: [...mat(-90, 90), ...band({ joint: 'ankleR' }, { joint: 'handR' })],
      keys: [quad(), quad({ hipR: -14, kneeR: 2, ankleR: 0 })],
      ms: [1000, 1200],
    }),

  clamshell: () => {
    const start = sideLying({
      hip: 40,
      knee: 70,
      fold: { thighL: 0.8, thighR: 0.8, shinL: 0.75, shinR: 0.75 },
    });
    const feetAt = jointOf(start, 'ankleR', 'face');
    return move({
      key: 'clamshell',
      label: 'Clamshell',
      description:
        'Clamshell, vu de face : couché sur le côté, genoux fléchis, pieds joints, on ouvre le genou du dessus sans bouger le bassin, puis on referme.',
      view: 'face',
      muscles: ['fessiers'],
      guides: { path: 'kneeL' },
      scene: [...mat(-60, 120), ...band({ joint: 'kneeL' }, { joint: 'kneeR' })],
      keys: [
        start,
        sideLying({
          hipR: 40,
          kneeR: 70,
          hipL: 76,
          fold: { thighL: 0.8, thighR: 0.8, shinL: 0.75, shinR: 0.75 },
          reach: { ankleL: feetAt },
        }),
      ],
      ms: [900, 1100],
    });
  },

  'abduction-couche': () =>
    move({
      key: 'abduction-couche',
      label: 'Abduction couchée',
      description:
        'Abduction couchée, vue de face : couché sur le côté, jambes tendues, on lève la jambe du dessus sans tourner le bassin, puis on la redescend lentement.',
      view: 'face',
      muscles: ['fessiers'],
      guides: { path: 'ankleL' },
      scene: mat(-60, 140),
      keys: [sideLying({ hip: 4 }), sideLying({ hipR: 4, hipL: 40 })],
      ms: [900, 1200],
    }),

  'marche-laterale': () => {
    const crouch = {
      trunk: 0,
      knee: 0,
      fold: { thighL: 0.84, thighR: 0.84 },
      shoulder: 14,
      elbow: 150,
    };
    return move({
      key: 'marche-laterale',
      label: 'Marche latérale',
      description:
        'Marche latérale, vue de face : élastique autour des genoux, en demi-squat, on fait un pas sur le côté puis on rapproche l’autre pied sans relâcher la tension.',
      view: 'face',
      muscles: ['fessiers'],
      guides: { path: 'ankleL' },
      scene: band({ joint: 'kneeL' }, { joint: 'kneeR' }),
      keys: [
        pose({ ...crouch, hip: 9, anchor: ground(0) }),
        pose({ ...crouch, hip: 18, anchor: ground(0) }),
      ],
      ms: 700,
    });
  },

  'swing-kettlebell': () =>
    move({
      key: 'swing-kettlebell',
      label: 'Swing kettlebell',
      description:
        'Swing kettlebell : charnière de hanche dos plat, la kettlebell passe entre les jambes, puis on pousse les hanches vers l’avant pour la projeter à hauteur de poitrine, bras tendus.',
      view: 'profil',
      muscles: ['fessiers', 'ischio-jambiers'],
      guides: { path: 'handL', back: true },
      grip: 'pronation',
      loads: [{ kind: 'kettlebell', at: 'hands' }],
      keys: [
        pose({ trunk: 66, hip: 96, knee: 26, shoulder: 36, elbow: 0, neck: -24, anchor: FEET }),
        pose({ trunk: -4, shoulder: 92, elbow: 0, anchor: FEET }),
      ],
      ms: [600, 700],
      holds: [80, 120],
    }),

  'extension-hanche-poulie': () => {
    const column = 52;
    return move({
      key: 'extension-hanche-poulie',
      label: 'Extension de hanche à la poulie',
      description:
        'Extension de hanche à la poulie : face à la machine, sangle à la cheville, on pousse la jambe tendue vers l’arrière sans cambrer, puis on revient.',
      view: 'profil',
      muscles: ['fessiers'],
      guides: { path: 'ankleL' },
      grip: 'neutre',
      scene: [...pulley(column, pt(column, 12), { joint: 'ankleL' }, 170)],
      keys: [
        pose({
          trunk: 14,
          hipL: 12,
          kneeL: 48,
          ankleL: 0,
          anchor: on('ankleR', 0, ANKLE_Y),
          reach: { handL: pt(column - 2, 118), handR: pt(column - 2, 118) },
        }),
        pose({
          trunk: 20,
          hipL: -30,
          kneeL: 6,
          ankleL: 0,
          anchor: on('ankleR', 0, ANKLE_Y),
          reach: { handL: pt(column - 2, 118), handR: pt(column - 2, 118) },
        }),
      ],
      ms: [900, 1200],
    });
  },

  'tirage-entre-jambes': () => {
    const column = -70;
    return move({
      key: 'tirage-entre-jambes',
      label: 'Tirage entre les jambes',
      description:
        'Tirage entre les jambes : dos à la poulie basse, corde entre les jambes, charnière de hanche dos plat, puis on pousse les hanches vers l’avant pour se redresser.',
      view: 'profil',
      muscles: ['fessiers', 'ischio-jambiers'],
      guides: { path: 'pelvis', back: true },
      grip: 'neutre',
      scene: pulley(column, pt(column, 14), { joint: 'handL' }, 150),
      keys: [
        pose({
          trunk: 70,
          hip: 98,
          knee: 24,
          neck: -24,
          anchor: FEET,
          reach: { handL: pt(-10, 40), handR: pt(-10, 40) },
        }),
        pose({ trunk: -2, anchor: FEET, reach: { handL: pt(4, 72), handR: pt(4, 72) } }),
      ],
      ms: [1100, 900],
    });
  },

  'squat-bulgare': (variant) => {
    const benchTop = 44;
    const rear = { ankleR: pt(-62, benchTop + 5) };
    return move({
      key: 'squat-bulgare',
      label: 'Squat bulgare',
      description:
        'Squat bulgare : pied arrière posé sur un banc, on descend sur la jambe avant jusqu’à la cuisse horizontale, genou au-dessus du pied, buste droit, puis on remonte.',
      view: 'profil',
      muscles: ['quadriceps', 'fessiers'],
      guides: { path: 'pelvis' },
      grip: 'neutre',
      scene: hasRig(variant, 'chaise') ? chair(-90, -50, benchTop, -1) : bench(-90, -48, benchTop),
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [
        pose({
          trunk: 6,
          hipL: 24,
          kneeL: 12,
          ankleR: -80,
          feet: { L: 'flat', R: 'free' },
          anchor: FEET,
          reach: rear,
        }),
        pose({
          trunk: 16,
          hipL: 98,
          kneeL: 96,
          ankleR: -80,
          feet: { L: 'flat', R: 'free' },
          anchor: FEET,
          reach: rear,
        }),
      ],
      ms: [1300, 1100],
    });
  },

  'squat-pistol': () =>
    move({
      key: 'squat-pistol',
      label: 'Squat pistol',
      description:
        'Squat pistol : sur une jambe, l’autre tendue devant, bras devant pour l’équilibre, on descend lentement le plus bas possible en contrôle, puis on remonte.',
      view: 'profil',
      muscles: ['quadriceps', 'fessiers'],
      guides: { path: 'pelvis' },
      keys: [
        pose({
          hipR: 32,
          kneeR: 4,
          ankleR: -10,
          feet: { L: 'flat', R: 'free' },
          shoulder: 80,
          elbow: 4,
          anchor: FEET,
        }),
        pose({
          trunk: 42,
          hipL: 132,
          kneeL: 138,
          hipR: 128,
          kneeR: 2,
          ankleR: 0,
          feet: { L: 'flat', R: 'free' },
          shoulder: 105,
          elbow: 4,
          neck: -20,
          anchor: FEET,
        }),
      ],
      ms: [1500, 1300],
    }),

  'good-morning': (variant) => {
    const bottom = barOnBack({ trunk: 70, hip: 84, knee: 16, neck: -28, anchor: FEET });
    const hips = jointOf(bottom, 'pelvis');
    return move({
      key: 'good-morning',
      label: 'Good morning',
      description:
        'Good morning : barre sur le haut du dos, genoux légèrement fléchis, on bascule le buste vers l’avant dos plat en poussant les hanches en arrière, puis on se redresse.',
      view: 'profil',
      muscles: ['ischio-jambiers', 'lombaires'],
      guides: { path: 'neck', back: true },
      // Charnière au mur : le bout des fesses vient toucher le mur, derrière soi.
      scene: hasRig(variant, 'mur') ? wall(hips.x - 12.5, -1) : [],
      loads: [{ kind: 'barre', at: 'back' }],
      keys: [barOnBack({ anchor: FEET }), bottom],
      ms: [1400, 1200],
    });
  },

  arabesque: () =>
    move({
      key: 'arabesque',
      label: 'Soulevé de terre sur une jambe',
      description:
        'Soulevé de terre sur une jambe : en équilibre sur une jambe, genou souple, on bascule le buste vers l’avant dos plat pendant que l’autre jambe monte derrière, puis on se redresse.',
      view: 'profil',
      muscles: ['ischio-jambiers', 'fessiers'],
      guides: { path: 'ankleR', back: true },
      grip: 'neutre',
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [
        pose({ hipR: 0, kneeR: 34, ankleR: -30, feet: { L: 'flat', R: 'free' }, anchor: FEET }),
        pose({
          trunk: 78,
          hipL: 76,
          kneeL: 14,
          hipR: -8,
          kneeR: 2,
          ankleR: 0,
          feet: { L: 'flat', R: 'free' },
          shoulder: 78,
          elbow: 2,
          neck: -24,
          anchor: FEET,
        }),
      ],
      ms: [1400, 1300],
    }),

  'nordic-curl': () => {
    const kneel = (lean: number) =>
      pose({
        trunk: lean,
        hip: 0,
        knee: 90 - lean,
        ankle: -84,
        feet: 'free',
        shoulder: 40 + lean,
        elbow: 50,
        anchor: on('kneeL', 0, KNEE_Y),
      });
    return move({
      key: 'nordic-curl',
      label: 'Nordic curl',
      description:
        'Nordic curl : à genoux, chevilles bloquées, corps droit des genoux à la tête, on se laisse tomber vers l’avant le plus lentement possible en freinant avec les ischio-jambiers.',
      view: 'profil',
      muscles: ['ischio-jambiers'],
      guides: { path: 'neck', back: true },
      scene: [
        ...mat(-60, 110),
        // Chevilles calées sous un meuble lourd (ou tenues par un partenaire).
        item('table', {
          kind: 'frame',
          a: { joint: 'ankleL', dx: -14, dy: 8 },
          b: { joint: 'ankleL', dx: 12, dy: 8 },
          r: 2.6,
        }),
        item('table', {
          kind: 'frame',
          a: { joint: 'ankleL', dx: 12, dy: 8 },
          b: { joint: 'ankleL', dx: 12, dy: -6 },
          r: 2.2,
        }),
      ],
      keys: [kneel(0), kneel(58)],
      ms: [2200, 1200],
    });
  },

  'curl-ischio-allonge': () => {
    const neck = pt(-60, 9.5);
    const legs = (x: number) => ({ ankleL: pt(x, 60), ankleR: pt(x, 60) });
    return move({
      key: 'curl-ischio-allonge',
      label: 'Curl ischio allongé',
      description:
        'Curl ischio allongé : sur le dos, talons sur un ballon, bassin levé, on ramène les talons vers les fesses en gardant le bassin haut, puis on tend les jambes.',
      view: 'profil',
      muscles: ['ischio-jambiers', 'fessiers'],
      guides: { path: 'ankleL' },
      grip: 'plat',
      scene: [
        ...mat(-84, 110),
        {
          equipment: 'swiss-ball',
          prop: { kind: 'ball', c: { joint: 'ankleL', dx: 6, dy: -32 }, r: 30 },
        },
      ],
      keys: [
        supine({ trunk: -112, shoulder: -20, ankle: 30, feet: 'free', reach: legs(56) }, neck),
        supine({ trunk: -128, shoulder: -34, ankle: 20, feet: 'free', reach: legs(26) }, neck),
      ],
      ms: [1200, 1200],
    });
  },

  'souleve-de-terre-kettlebell': () => {
    const handle = pt(5, 22);
    return move({
      key: 'souleve-de-terre-kettlebell',
      label: 'Soulevé de terre kettlebell',
      description:
        'Soulevé de terre kettlebell : la kettlebell entre les pieds, dos plat, hanches en arrière, on la saisit à deux mains et on se redresse en poussant dans le sol.',
      view: 'profil',
      muscles: ['fessiers', 'ischio-jambiers'],
      guides: { path: 'handL', back: true },
      grip: 'pronation',
      loads: [{ kind: 'kettlebell', at: 'hands' }],
      keys: [
        pose({
          trunk: 54,
          hip: 112,
          knee: 72,
          neck: -22,
          anchor: FEET,
          reach: { handL: handle, handR: handle },
        }),
        pose({ anchor: FEET, reach: { handL: pt(6, 78), handR: pt(6, 78) } }),
      ],
      ms: [1200, 1200],
    });
  },

  'leg-curl-elastique': () => {
    const post = pt(-120, 8);
    return move({
      key: 'leg-curl-elastique',
      label: 'Leg curl à l’élastique',
      description:
        'Leg curl à l’élastique : à plat ventre, élastique à la cheville, on ramène le talon vers la fesse, bassin plaqué au sol, puis on tend la jambe lentement.',
      view: 'profil',
      muscles: ['ischio-jambiers'],
      guides: { path: 'heelL' },
      grip: 'plat',
      scene: [...mat(-115, 80), ...band({ joint: 'ankleL' }, post)],
      keys: [
        prone({ shoulder: 176, elbow: 2 }),
        prone({
          shoulder: 176,
          elbow: 2,
          kneeL: 112,
          ankleL: -20,
          contacts: ['pelvis', 'kneeL', 'toeR'],
        }),
      ],
      ms: [1000, 1300],
    });
  },

  'mollets-une-jambe': () =>
    move({
      key: 'mollets-une-jambe',
      label: 'Mollet sur une jambe',
      description:
        'Mollet sur une jambe : en appui sur un pied, l’autre accroché derrière la cheville, une main au mur, on monte sur la pointe le plus haut possible puis on redescend.',
      view: 'profil',
      muscles: ['mollets'],
      guides: { path: 'heelL' },
      keys: [
        pose({
          ankleL: 0,
          hipR: 8,
          kneeR: 70,
          ankleR: -30,
          feet: { R: 'free' },
          anchor: on('toeL', 14, 0),
        }),
        pose({
          ankleL: -34,
          hipR: 8,
          kneeR: 70,
          ankleR: -30,
          feet: { R: 'free' },
          anchor: on('toeL', 14, 0),
        }),
      ],
      ms: [800, 1100],
      holds: [300, 500],
    }),

  'mollets-assis': () => {
    const seatTop = 44;
    const legs = (y: number) => ({ ankleL: pt(43, y), ankleR: pt(43, y) });
    return move({
      key: 'mollets-assis',
      label: 'Mollets assis',
      description:
        'Mollets assis : assis, pieds à plat, charge posée sur les genoux, on monte les talons le plus haut possible, puis on redescend lentement.',
      view: 'profil',
      muscles: ['mollets'],
      guides: { path: 'kneeL' },
      grip: 'neutre',
      scene: bench(-40, 16, seatTop),
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [
        pose({
          anchor: on('pelvis', 0, seatTop + 10),
          reach: { ...legs(ANKLE_Y), handL: pt(40, 70), handR: pt(40, 70) },
          feet: 'flat',
        }),
        pose({
          anchor: on('pelvis', 0, seatTop + 10),
          reach: { ...legs(14), handL: pt(41, 77), handR: pt(41, 77) },
          feet: 'toes',
        }),
      ],
      ms: [800, 1100],
      holds: [300, 500],
    });
  },
};
