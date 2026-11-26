/** Mobilité, étirements et équilibre. */
import { mat, wall, item } from './scene';
import { hasRig } from './rigs';
import { jointOf, move } from './build';
import { FEET, prone, quad, quadHands, seatedFloor } from './helpers';
import { ANKLE_Y, KNEE_Y, PALM_Y, ground, on, pose, pt } from './pose';
import type { MovementFactory } from './types';

export const MOBILITY: Record<string, MovementFactory> = {
  'cercles-bras': () => {
    const arms = (abduction: number, fold: number) =>
      pose({
        hip: 6,
        shoulder: abduction,
        elbow: 2,
        fold: { upperArmL: fold, upperArmR: fold, forearmL: fold, forearmR: fold },
        anchor: ground(0),
      });
    return move({
      key: 'cercles-bras',
      label: 'Cercles de bras',
      description:
        'Cercles de bras, vu de face : debout, bras tendus sur les côtés à hauteur d’épaules, on trace de petits cercles avec les mains, dans un sens puis dans l’autre.',
      view: 'face',
      muscles: ['epaules'],
      guides: { path: 'handL' },
      keys: [arms(82, 1), arms(90, 0.93), arms(98, 1), arms(90, 0.97)],
      loop: 'boucle',
      endIndex: 2,
      ms: 320,
      holds: [0, 0],
    });
  },

  'rotation-epaules': () =>
    move({
      key: 'rotation-epaules',
      label: 'Rotation des épaules',
      description:
        'Rotation des épaules : debout, bras relâchés, on fait rouler les épaules vers l’avant, vers le haut, vers l’arrière puis vers le bas.',
      view: 'profil',
      muscles: ['epaules'],
      guides: { path: 'shoulderL' },
      keys: [
        pose({ shoulder: 8, anchor: FEET }),
        pose({ shoulder: 12, shrug: 3, spine: 6, anchor: FEET }),
        pose({ shoulder: 2, shrug: 6, anchor: FEET }),
        pose({ shoulder: -6, shrug: 2, spine: -6, anchor: FEET }),
      ],
      loop: 'boucle',
      endIndex: 2,
      ms: 500,
      holds: [0, 0],
    }),

  'chat-vache': () =>
    move({
      key: 'chat-vache',
      label: 'Chat-vache',
      description:
        'Chat-vache : à quatre pattes, on arrondit le dos vers le plafond en rentrant le menton, puis on creuse le dos en levant le regard, lentement, au rythme de la respiration.',
      view: 'profil',
      muscles: ['lombaires', 'abdominaux'],
      guides: { path: 'waist' },
      scene: mat(-60, 90),
      keys: [quad({ trunk: 62, spine: 30, neck: 26 }), quad({ trunk: 80, spine: -22, neck: -30 })],
      ms: [1600, 1600],
      holds: [500, 500],
    }),

  'position-enfant': () => {
    const reach = { handL: pt(54, PALM_Y), handR: pt(54, PALM_Y) };
    return move({
      key: 'position-enfant',
      label: 'Posture de l’enfant',
      description:
        'Posture de l’enfant : à genoux, on s’assoit sur les talons et on allonge le buste vers l’avant, bras tendus devant, front vers le sol, et on respire.',
      view: 'profil',
      muscles: ['lombaires', 'dos'],
      guides: { path: 'pelvis' },
      grip: 'plat',
      scene: mat(-60, 80),
      keys: [
        quad(),
        pose({
          trunk: 104,
          spine: 8,
          neck: 10,
          hip: 160,
          knee: 150,
          ankle: -90,
          feet: 'free',
          anchor: on('kneeL', 0, KNEE_Y),
          reach,
          bend: { handL: -1, handR: -1 },
          grip: 'plat',
        }),
      ],
      ms: [1800, 1500],
      holds: [400, 1500],
    });
  },

  'cercles-hanches': () => {
    const feet = { ankleL: pt(11, ANKLE_Y), ankleR: pt(-11, ANKLE_Y) };
    const hips = (dx: number, lean: number) => {
      const p = pose({ trunk: lean, anchor: on('pelvis', dx, 92), reach: feet });
      const waist = jointOf(p, 'waist', 'face');
      return pose({
        trunk: lean,
        anchor: on('pelvis', dx, 92),
        reach: {
          ...feet,
          handL: pt(waist.x + 13, waist.y - 6),
          handR: pt(waist.x - 13, waist.y - 6),
        },
        bend: { handL: -1, handR: -1 },
        grip: 'plat',
      });
    };
    return move({
      key: 'cercles-hanches',
      label: 'Cercles de hanches',
      description:
        'Cercles de hanches, vu de face : debout, mains sur les hanches, pieds écartés, on fait tracer au bassin de grands cercles lents, buste stable.',
      view: 'face',
      muscles: ['lombaires'],
      guides: { path: 'pelvis' },
      keys: [hips(-6, -4), hips(0, 0), hips(6, 4), hips(0, 0)],
      loop: 'boucle',
      endIndex: 2,
      ms: 700,
      holds: [0, 0],
    });
  },

  'rotation-thoracique': () => {
    const hands = quadHands();
    const open = (shoulder: number, elbow: number, spine: number) =>
      quad({
        spine,
        shoulderL: shoulder,
        elbowL: elbow,
        reach: { handR: hands.handR },
        grip: { R: 'paume', L: 'nuque' },
      });
    return move({
      key: 'rotation-thoracique',
      label: 'Rotation thoracique',
      description:
        'Rotation thoracique : à quatre pattes, une main derrière la nuque, on fait descendre le coude vers le bras d’appui, puis on l’ouvre vers le plafond en tournant le haut du dos.',
      view: 'profil',
      muscles: ['dos'],
      guides: { path: 'elbowL' },
      scene: mat(-60, 90),
      keys: [open(40, 150, 6), open(205, 140, -8)],
      ms: [1400, 1400],
    });
  },

  'etirement-flechisseurs': () => {
    const front = { ankleL: pt(46, ANKLE_Y) };
    const lunge = (thigh: number, arms: number) =>
      pose({
        hipR: thigh,
        kneeR: 90 + thigh,
        ankleR: -86,
        feet: { L: 'flat', R: 'free' },
        shoulder: arms,
        elbow: 4,
        anchor: on('kneeR', 0, KNEE_Y),
        reach: front,
      });
    return move({
      key: 'etirement-flechisseurs',
      label: 'Étirement des fléchisseurs de hanche',
      description:
        'Étirement des fléchisseurs de hanche : en fente basse, genou arrière au sol, on avance doucement le bassin en gardant le buste droit et on tient.',
      view: 'profil',
      muscles: ['quadriceps'],
      guides: { path: 'pelvis' },
      scene: mat(-60, 70),
      keys: [lunge(0, 6), lunge(-24, 170)],
      ms: [1500, 1300],
      holds: [400, 1600],
    });
  },

  'etirement-quadriceps': () =>
    move({
      key: 'etirement-quadriceps',
      label: 'Étirement des quadriceps',
      description:
        'Étirement des quadriceps : debout sur une jambe, on attrape la cheville et on ramène le talon vers la fesse, genoux serrés, bassin neutre.',
      view: 'profil',
      muscles: ['quadriceps'],
      guides: { path: 'heelL' },
      keys: [
        pose({ anchor: on('ankleR', 0, ANKLE_Y) }),
        (() => {
          const p = pose({
            hipL: -6,
            kneeL: 150,
            ankleL: -40,
            feet: { R: 'flat', L: 'free' },
            shoulderR: 80,
            elbowR: 4,
            anchor: on('ankleR', 0, ANKLE_Y),
          });
          const ankle = jointOf(p, 'ankleL');
          return pose({
            hipL: -6,
            kneeL: 150,
            ankleL: -40,
            feet: { R: 'flat', L: 'free' },
            shoulderR: 80,
            elbowR: 4,
            anchor: on('ankleR', 0, ANKLE_Y),
            reach: { handL: pt(ankle.x - 1, ankle.y + 2) },
            grip: { L: 'neutre' },
            contacts: ['heelR'],
          });
        })(),
      ],
      ms: [1300, 1300],
      holds: [300, 1600],
    }),

  'etirement-mollets': () => {
    const wallX = 72;
    const legs = { ankleL: pt(26, ANKLE_Y), ankleR: pt(-34, ANKLE_Y) };
    const lean = (pelvisX: number, pelvisY: number, trunk: number) => {
      const p = pose({ trunk, anchor: on('pelvis', pelvisX, pelvisY), reach: legs });
      const sh = jointOf(p, 'shoulderL');
      return pose({
        trunk,
        anchor: on('pelvis', pelvisX, pelvisY),
        reach: { ...legs, handL: pt(wallX - 2.6, sh.y + 2), handR: pt(wallX - 2.6, sh.y + 2) },
        grip: 'paume',
      });
    };
    return move({
      key: 'etirement-mollets',
      label: 'Étirement des mollets',
      description:
        'Étirement des mollets : face au mur, mains en appui, jambe arrière tendue talon au sol, on fléchit le genou avant pour avancer le bassin et on tient.',
      view: 'profil',
      muscles: ['mollets'],
      guides: { path: 'pelvis' },
      scene: wall(wallX, 1),
      keys: [lean(-2, 84, 8), lean(8, 79, 16)],
      ms: [1300, 1300],
      holds: [300, 1600],
    });
  },

  'etirement-pectoraux': () => {
    const post = -18;
    const stretch = (trunk: number) =>
      pose({
        trunk,
        shoulderL: -94 + trunk,
        elbowL: -90,
        fold: { upperArmL: 0.7 },
        anchor: on('handL', post + 3, 150),
        reach: { ankleL: pt(28, ANKLE_Y), ankleR: pt(-6, ANKLE_Y) },
        grip: { L: 'paume' },
      });
    return move({
      key: 'etirement-pectoraux',
      label: 'Étirement des pectoraux',
      description:
        'Étirement des pectoraux : avant-bras contre le montant d’une porte, coude à hauteur d’épaule, on avance d’un pas pour ouvrir la poitrine et on tient.',
      view: 'profil',
      muscles: ['pectoraux'],
      guides: { path: 'neck' },
      scene: [item('mur', { kind: 'frame', a: pt(post, 0.8), b: pt(post, 200), r: 3 })],
      keys: [stretch(0), stretch(12)],
      ms: [1300, 1300],
      holds: [300, 1600],
    });
  },

  'etirement-ischio': () => {
    const toe = jointOf(seatedFloor(), 'toeL');
    return move({
      key: 'etirement-ischio',
      label: 'Étirement des ischio-jambiers',
      description:
        'Étirement des ischio-jambiers : assis, une jambe tendue, l’autre pliée, on penche le buste vers le pied en gardant le dos long et on tient.',
      view: 'profil',
      muscles: ['ischio-jambiers'],
      guides: { path: 'neck', back: true },
      scene: mat(-30, 100),
      keys: [
        seatedFloor({
          ankleR: -30,
          fold: { thighR: 0.6, shinR: 0.5 },
          reach: { ankleR: pt(24, 12) },
          shoulder: 60,
          elbow: 6,
        }),
        seatedFloor({
          trunk: 40,
          spine: 12,
          neck: -10,
          ankleR: -30,
          fold: { thighR: 0.6, shinR: 0.5 },
          reach: {
            ankleR: pt(24, 12),
            handL: pt(toe.x - 4, toe.y + 4),
            handR: pt(toe.x - 8, toe.y + 4),
          },
          grip: 'neutre',
        }),
      ],
      ms: [1500, 1300],
      holds: [300, 1600],
    });
  },

  cobra: () => {
    const sh = jointOf(prone(), 'shoulderL');
    const hands = { handL: pt(sh.x + 2, PALM_Y), handR: pt(sh.x + 2, PALM_Y) };
    return move({
      key: 'cobra',
      label: 'Cobra',
      description:
        'Cobra : à plat ventre, mains sous les épaules, on pousse doucement pour relever la poitrine, bassin au sol, épaules basses, puis on redescend.',
      view: 'profil',
      muscles: ['lombaires', 'abdominaux'],
      guides: { path: 'neck' },
      grip: 'paume',
      scene: mat(-100, 90),
      keys: [prone({ reach: hands }), prone({ trunk: 84, spine: -52, neck: -10, reach: hands })],
      ms: [1500, 1300],
      holds: [400, 1200],
    });
  },

  pigeon: () => {
    const back = { ankleR: pt(-84, 4.5) };
    const p = (trunk: number, hands: number) =>
      pose({
        trunk,
        ankleL: -88,
        fold: { thighL: 0.85, shinL: 0.35 },
        ankleR: -86,
        feet: 'free',
        anchor: on('pelvis', 0, 17),
        reach: { ...back, ankleL: pt(22, 7), handL: pt(hands, PALM_Y), handR: pt(hands, PALM_Y) },
        grip: 'plat',
      });
    return move({
      key: 'pigeon',
      label: 'Pigeon',
      description:
        'Pigeon : un genou plié devant, la jambe arrière tendue au sol, on garde le bassin face au sol, puis on penche le buste vers l’avant sur les avant-bras et on respire.',
      view: 'profil',
      muscles: ['fessiers'],
      guides: { path: 'neck' },
      scene: mat(-100, 80),
      keys: [p(4, 16), p(62, 52)],
      ms: [1600, 1400],
      holds: [400, 1600],
    });
  },

  'equilibre-une-jambe': (variant) => {
    // Sur un coussin ferme : le pied d'appui est surélevé, le coussin se tasse un peu sous lui.
    const cushion = hasRig(variant, 'coussin') ? 6 : 0;
    return move({
      key: 'equilibre-une-jambe',
      label: 'Équilibre sur une jambe',
      description:
        'Équilibre sur une jambe : debout, on lève un pied derrière soi, genou fléchi, regard fixe, et on tient sans bouger.',
      view: 'profil',
      muscles: ['mollets'],
      scene:
        cushion > 0
          ? [item('coussin', { kind: 'pad', a: pt(-16, 3.4), b: pt(16, 3.4), r: 3.4 })]
          : [],
      keys: [
        pose({ shoulder: 10, anchor: on('ankleR', 0, ANKLE_Y + cushion) }),
        pose({
          hipL: -4,
          kneeL: 72,
          ankleL: -30,
          feet: { R: 'flat', L: 'free' },
          shoulder: 14,
          anchor: on('ankleR', 0, ANKLE_Y + cushion),
        }),
      ],
      ms: [900, 900],
      holds: [300, 2000],
    });
  },

  'equilibre-genou-leve': () =>
    move({
      key: 'equilibre-genou-leve',
      label: 'Équilibre genou levé',
      description:
        'Équilibre genou levé : debout sur une jambe, on monte l’autre genou à hauteur de hanche, buste droit, et on tient.',
      view: 'profil',
      muscles: ['abdominaux'],
      guides: { path: 'kneeL' },
      keys: [
        pose({ anchor: on('ankleR', 0, ANKLE_Y) }),
        pose({
          hipL: 92,
          kneeL: 92,
          ankleL: -20,
          feet: { R: 'flat', L: 'free' },
          shoulder: 10,
          anchor: on('ankleR', 0, ANKLE_Y),
        }),
      ],
      ms: [1000, 1000],
      holds: [300, 2000],
    }),

  'marche-talon-pointe': () => {
    const stance = (front: 'L' | 'R') =>
      front === 'L'
        ? pose({
            anchor: on('toeR', 0, 0),
            reach: { ankleL: pt(18.6, ANKLE_Y) },
            shoulder: 50,
            elbow: 10,
            fold: { upperArmL: 0.5, upperArmR: 0.5, forearmL: 0.6, forearmR: 0.6 },
          })
        : pose({
            anchor: on('toeL', 0, 0),
            reach: { ankleR: pt(18.6, ANKLE_Y) },
            shoulder: 50,
            elbow: 10,
            fold: { upperArmL: 0.5, upperArmR: 0.5, forearmL: 0.6, forearmR: 0.6 },
          });
    return move({
      key: 'marche-talon-pointe',
      label: 'Marche talon-pointe',
      description:
        'Marche talon-pointe : on avance en ligne droite en posant le talon juste devant la pointe de l’autre pied, bras écartés pour l’équilibre.',
      view: 'profil',
      muscles: ['mollets'],
      guides: { path: 'ankleL' },
      keys: [stance('L'), stance('R')],
      ms: 900,
    });
  },
};
