/** Gainage et abdominaux (suite), lombaires, cardio. */
import { ball, mat, pulley, pullupBar, machine } from './scene';
import { jointOf, move } from './build';
import { FEET, nape, prone, quad, quadHands, supine } from './helpers';
import { ANKLE_Y, KNEE_Y, PALM_Y, ground, on, pose, pt } from './pose';
import type { PoseSpec } from './pose';
import { tune } from './tune';
import type { MovementFactory } from './types';

const behindHead = (spec: PoseSpec) => {
  const target = nape(spec);
  return pose({ ...spec, grip: 'nuque', reach: { ...spec.reach, handL: target, handR: target } });
};

/** Planche haute bras tendus, mains posées en `handX`. */
function highPlankAt(handX: number, legs: Partial<Record<string, number>> = {}) {
  const make = (trunk: number) =>
    pose({
      trunk,
      shoulder: trunk,
      elbow: 0,
      ankle: trunk - 78,
      ...legs,
      anchor: on('handL', handX, PALM_Y),
      grip: 'paume',
    });
  const trunk = tune((t) => jointOf(make(t), 'toeR').y, 2.4, 40, 89);
  return make(trunk);
}

export const CORE2: Record<string, MovementFactory> = {
  'rentree-ventre': () => {
    const legs = { ankleL: pt(22, ANKLE_Y), ankleR: pt(22, ANKLE_Y) };
    return move({
      key: 'rentree-ventre',
      label: 'Rentrée du ventre',
      description:
        'Rentrée du ventre : allongé sur le dos, genoux fléchis, on expire en creusant le ventre et en plaquant le bas du dos au sol, puis on relâche.',
      view: 'profil',
      muscles: ['abdominaux'],
      grip: 'plat',
      scene: mat(-80, 50),
      keys: [
        supine({ reach: legs, shoulder: -2 }),
        supine({ reach: legs, shoulder: -2, trunk: -94, spine: 4 }),
      ],
      ms: [1400, 1400],
      holds: [400, 1200],
    });
  },

  'crunch-poulie': () => {
    const kneel = (trunk: number, spine: number) =>
      behindHead({
        trunk,
        spine,
        neck: 20,
        hip: trunk,
        knee: 90,
        ankle: -90,
        anchor: on('kneeL', 0, KNEE_Y),
      });
    const top = jointOf(kneel(8, 0), 'head');
    return move({
      key: 'crunch-poulie',
      label: 'Crunch à la poulie',
      description:
        'Crunch à la poulie : à genoux, corde tenue près de la tête, on enroule le buste vers le sol en contractant les abdominaux, hanches fixes, puis on se redresse.',
      view: 'profil',
      muscles: ['abdominaux'],
      guides: { path: 'head' },
      scene: pulley(top.x - 20, pt(top.x - 20, 210), { joint: 'handL' }, 214),
      keys: [kneel(10, 0), kneel(34, 56)],
      ms: [1000, 1300],
    });
  },

  'dead-bug': () => {
    const hips = on('pelvis', 0, 10);
    const table = { hip: 90, knee: 90, ankle: -10, shoulder: 90, elbow: 0 };
    return move({
      key: 'dead-bug',
      label: 'Dead bug',
      description:
        'Dead bug : allongé, bras tendus vers le plafond et genoux à angle droit, on allonge un bras derrière la tête et la jambe opposée, bas du dos au sol, puis on revient.',
      view: 'profil',
      muscles: ['abdominaux'],
      guides: { path: 'ankleR' },
      scene: mat(-80, 70),
      keys: [
        pose({ trunk: -90, neck: 6, ...table, anchor: hips, contacts: ['pelvis', 'neck'] }),
        pose({
          trunk: -90,
          neck: 6,
          ...table,
          shoulderL: 170,
          hipR: 12,
          kneeR: 4,
          anchor: hips,
          contacts: ['pelvis', 'neck'],
        }),
      ],
      ms: [1300, 1300],
      holds: [300, 600],
    });
  },

  'bird-dog': () =>
    move({
      key: 'bird-dog',
      label: 'Bird-dog',
      description:
        'Bird-dog : à quatre pattes, dos plat, on tend un bras devant et la jambe opposée derrière à l’horizontale, sans tourner le bassin, puis on revient.',
      view: 'profil',
      muscles: ['lombaires', 'fessiers', 'abdominaux'],
      guides: { back: true },
      scene: mat(-70, 90),
      keys: [
        quad(),
        quad({
          reach: { handR: quadHands().handR },
          shoulderL: 165,
          elbowL: 0,
          hipR: 0,
          kneeR: 2,
          ankleR: -40,
        }),
      ],
      ms: [1300, 1300],
      holds: [300, 900],
    }),

  'planche-genoux': () => {
    const knees = (trunk: number) =>
      pose({
        trunk,
        shoulder: trunk,
        elbow: 90,
        hip: 6,
        knee: 96 - trunk,
        ankle: -72,
        anchor: on('kneeL', 0, KNEE_Y),
        grip: 'plat',
      });
    const t = tune((x) => jointOf(knees(x), 'elbowL').y, 4.5, 40, 89);
    return move({
      key: 'planche-genoux',
      label: 'Planche sur les genoux',
      description:
        'Planche sur les genoux : en appui sur les avant-bras et les genoux, coudes sous les épaules, corps aligné des épaules aux genoux, on tient la position.',
      view: 'profil',
      muscles: ['abdominaux'],
      guides: { back: true },
      scene: mat(-40, 110),
      keys: [
        pose({
          trunk: t + 8,
          shoulder: t + 8,
          elbow: 90,
          hip: 30,
          knee: 90,
          ankle: -72,
          anchor: on('kneeL', 0, KNEE_Y),
          grip: 'plat',
        }),
        knees(t),
      ],
      ms: [1200, 1200],
      holds: [400, 2000],
    });
  },

  'planche-laterale': () => {
    // Vue de face : couché sur le côté droit, appui sur l'avant-bras droit (raccourci) et les pieds.
    const side = (trunk: number, hips: number) =>
      pose({
        trunk,
        shoulderR: -trunk,
        elbowR: 90,
        shoulderL: 20,
        elbowL: 110,
        hipR: -hips,
        hipL: hips,
        knee: 0,
        ankle: -88,
        feet: 'free',
        fold: { forearmR: 0.3 },
        anchor: on('elbowR', 0, 4.5),
        grip: { R: 'plat', L: 'paume' },
      });
    const lift = tune((t) => jointOf(side(t, 0), 'toeR', 'face').y, 1, -88, -60);
    return move({
      key: 'planche-laterale',
      label: 'Planche latérale',
      description:
        'Planche latérale, vue de face : couché sur le côté, en appui sur l’avant-bras, coude sous l’épaule, on soulève le bassin pour aligner chevilles, hanches et épaules, et on tient.',
      view: 'face',
      muscles: ['abdominaux', 'fessiers'],
      guides: { path: 'pelvis' },
      scene: mat(-40, 150),
      keys: [side(-70, 22), side(lift, 0)],
      ms: [1200, 1200],
      holds: [400, 1600],
    });
  },

  'crunch-inverse': () => {
    const shoulders = pt(-46, 9.5);
    return move({
      key: 'crunch-inverse',
      label: 'Crunch inversé',
      description:
        'Crunch inversé : allongé, genoux à angle droit, on ramène les genoux vers la poitrine en décollant le bassin, puis on redescend lentement.',
      view: 'profil',
      muscles: ['abdominaux'],
      guides: { path: 'kneeL' },
      grip: 'plat',
      scene: mat(-80, 50),
      keys: [
        supine({ hip: 88, knee: 92, ankle: -20, shoulder: -2 }, shoulders),
        supine({ trunk: -112, hip: 128, knee: 118, ankle: -20, shoulder: 18 }, shoulders),
      ],
      ms: [1000, 1300],
    });
  },

  'releve-jambes-allonge': () =>
    move({
      key: 'releve-jambes-allonge',
      label: 'Relevé de jambes allongé',
      description:
        'Relevé de jambes allongé : sur le dos, jambes tendues, on lève les jambes jusqu’à la verticale, bas du dos plaqué, puis on redescend sans toucher le sol.',
      view: 'profil',
      muscles: ['abdominaux'],
      guides: { path: 'ankleL' },
      grip: 'plat',
      scene: mat(-80, 100),
      keys: [
        supine({ hip: 12, knee: 2, ankle: -30, feet: 'free', shoulder: -2 }),
        supine({ hip: 88, knee: 2, ankle: -20, feet: 'free', shoulder: -2 }),
      ],
      ms: [1300, 1500],
    }),

  'hollow-hold': () =>
    move({
      key: 'hollow-hold',
      label: 'Hollow hold',
      description:
        'Hollow hold : allongé, bas du dos plaqué au sol, on décolle les épaules et les jambes tendues, bras tendus derrière la tête, et on tient la coque.',
      view: 'profil',
      muscles: ['abdominaux'],
      guides: { back: false },
      scene: mat(-100, 100),
      keys: [
        pose({
          trunk: -90,
          shoulder: 176,
          elbow: 0,
          hip: 4,
          ankle: -40,
          feet: 'free',
          anchor: on('pelvis', 0, 10),
        }),
        pose({
          trunk: -90,
          spine: 22,
          neck: 8,
          shoulder: 170,
          elbow: 0,
          hip: 26,
          ankle: -40,
          feet: 'free',
          anchor: on('pelvis', 0, 10),
          contacts: ['pelvis'],
        }),
      ],
      ms: [1200, 1200],
      holds: [300, 1600],
    }),

  'russian-twist': () => {
    const sit = (side: 1 | -1) => {
      const hands = pt(side * 26, 30);
      return pose({
        trunk: side * 10,
        hip: 150,
        knee: 100,
        ankle: -20,
        feet: 'free',
        fold: { thighL: 0.45, thighR: 0.45, shinL: 0.5, shinR: 0.5, torso: 0.86 },
        anchor: on('pelvis', 0, 11),
        reach: { handL: hands, handR: hands },
        grip: 'neutre',
        contacts: ['pelvis'],
      });
    };
    return move({
      key: 'russian-twist',
      label: 'Russian twist',
      description:
        'Russian twist, vu de face : assis buste incliné en arrière, pieds décollés, on tourne le buste pour amener la charge d’un côté puis de l’autre.',
      view: 'face',
      muscles: ['abdominaux'],
      guides: { path: 'handL' },
      scene: mat(-70, 70),
      loads: [{ kind: 'halteres', at: 'handL' }],
      keys: [sit(1), sit(-1)],
      ms: 900,
      holds: [150, 150],
    });
  },

  'flexion-laterale': () =>
    move({
      key: 'flexion-laterale',
      label: 'Flexion latérale',
      description:
        'Flexion latérale, vue de face : debout, une charge dans une main, on incline le buste sur le côté de la charge, puis on se redresse sans pencher en avant.',
      view: 'face',
      muscles: ['abdominaux'],
      guides: { path: 'handL' },
      grip: { L: 'neutre' },
      loads: [{ kind: 'halteres', at: 'handL' }],
      keys: [
        pose({ hip: 6, shoulderL: 4, elbowL: 0, shoulderR: 30, elbowR: 120, anchor: ground(0) }),
        pose({
          trunk: 18,
          spine: 6,
          hip: 6,
          hipL: -10,
          hipR: 22,
          shoulderL: 22,
          elbowL: 0,
          shoulderR: 50,
          elbowR: 120,
          anchor: ground(0),
        }),
      ],
      ms: [1100, 1100],
    }),

  pallof: () => {
    const stand = (fold: number) =>
      pose({
        hip: 12,
        knee: 6,
        shoulder: 20,
        elbow: 100 - fold * 80,
        fold: {
          upperArmL: 0.6,
          upperArmR: 0.6,
          forearmL: 0.4 + fold * 0.1,
          forearmR: 0.4 + fold * 0.1,
        },
        anchor: ground(0),
        grip: 'neutre',
      });
    const chest = jointOf(stand(0), 'handL', 'face');
    return move({
      key: 'pallof',
      label: 'Pallof press',
      description:
        'Pallof press, vu de face : debout de profil à la poulie, mains contre la poitrine, on pousse les mains droit devant sans laisser le buste tourner, puis on les ramène.',
      view: 'face',
      muscles: ['abdominaux'],
      guides: { path: 'handL' },
      scene: pulley(-80, pt(-80, chest.y), { joint: 'handR' }, 150),
      keys: [stand(0), stand(1)],
      ms: [1000, 1000],
      holds: [300, 800],
    });
  },

  'releve-genoux-suspendu': () => {
    const bar = pt(14, 214);
    const hang = (hip: number, knee: number) =>
      pose({
        trunk: -2,
        shoulder: 176,
        elbow: 4,
        hip,
        knee,
        ankle: -30,
        feet: 'free',
        anchor: on('handL', bar.x, bar.y),
        grip: 'pronation',
      });
    return move({
      key: 'releve-genoux-suspendu',
      label: 'Relevé de genoux suspendu',
      description:
        'Relevé de genoux suspendu : suspendu à la barre, bras tendus, on monte les genoux vers la poitrine en enroulant le bassin, puis on redescend sans balancer.',
      view: 'profil',
      muscles: ['abdominaux'],
      guides: { path: 'kneeL' },
      scene: pullupBar(bar, 226),
      keys: [hang(4, 10), hang(110, 100)],
      ms: [1000, 1300],
    });
  },

  'releve-jambes-suspendu': () => {
    const bar = pt(14, 214);
    const hang = (hip: number) =>
      pose({
        trunk: -2,
        shoulder: 176,
        elbow: 4,
        hip,
        knee: 2,
        ankle: -30,
        feet: 'free',
        anchor: on('handL', bar.x, bar.y),
        grip: 'pronation',
      });
    return move({
      key: 'releve-jambes-suspendu',
      label: 'Relevé de jambes suspendu',
      description:
        'Relevé de jambes suspendu : suspendu à la barre, on lève les jambes tendues jusqu’à l’horizontale, puis on redescend lentement.',
      view: 'profil',
      muscles: ['abdominaux'],
      guides: { path: 'ankleL' },
      scene: pullupBar(bar, 226),
      keys: [hang(4), hang(88)],
      ms: [1100, 1400],
    });
  },

  'releve-genoux-chaise': () => {
    const pad = pt(0, 128);
    const chairPose = (hip: number, knee: number) =>
      pose({
        trunk: 0,
        shoulder: 0,
        elbow: 90,
        hip,
        knee,
        ankle: -30,
        feet: 'free',
        anchor: on('elbowL', pad.x, pad.y + 4),
        grip: 'neutre',
        contacts: ['elbowL', 'elbowR'],
      });
    return move({
      key: 'releve-genoux-chaise',
      label: 'Relevé de genoux à la chaise romaine',
      description:
        'Relevé de genoux à la chaise romaine : avant-bras sur les appuis, dos plaqué au dossier, on monte les genoux vers la poitrine, puis on redescend sans élan.',
      view: 'profil',
      muscles: ['abdominaux'],
      guides: { path: 'kneeL' },
      scene: [
        machine.frame(pt(-16, 0.8), pt(-16, 160), 2.2),
        machine.pad(pt(-11, 70), pt(-11, 150), 3.4),
        machine.pad(pt(-6, pad.y), pt(26, pad.y), 3),
        machine.frame(pt(-16, pad.y - 4), pt(24, pad.y - 4), 1.4),
        machine.frame(pt(-28, 0.8), pt(4, 0.8), 1.2),
      ],
      keys: [chairPose(4, 6), chairPose(108, 104)],
      ms: [1000, 1300],
    });
  },

  'rotation-bucheron': () => {
    const stand = (hands: { x: number; y: number }, trunk: number, knee: number) =>
      pose({
        trunk,
        hip: 14,
        knee,
        anchor: ground(0),
        reach: { handL: hands, handR: hands },
        grip: 'neutre',
      });
    return move({
      key: 'rotation-bucheron',
      label: 'Bûcheron à la poulie',
      description:
        'Bûcheron à la poulie, vu de face : pieds écartés, on tire la poignée d’en haut d’un côté vers le bas de l’autre côté en tournant le buste, bras presque tendus, puis on revient.',
      view: 'face',
      muscles: ['abdominaux', 'epaules'],
      guides: { path: 'handL' },
      scene: pulley(78, pt(78, 186), { joint: 'handL' }, 192),
      keys: [stand(pt(48, 168), 10, 4), stand(pt(-30, 70), -10, 12)],
      ms: [1000, 1300],
    });
  },

  superman: () =>
    move({
      key: 'superman',
      label: 'Superman',
      description:
        'Superman : à plat ventre, bras tendus devant, on soulève ensemble bras, poitrine et jambes de quelques centimètres, regard vers le sol, puis on repose.',
      view: 'profil',
      muscles: ['lombaires', 'fessiers'],
      guides: { path: 'handL' },
      grip: 'plat',
      scene: mat(-100, 110),
      keys: [
        prone({ shoulder: 178, elbow: 2 }),
        prone({ spine: -12, neck: -6, shoulder: 186, elbow: 2, hip: -14, contacts: ['pelvis'] }),
      ],
      ms: [1000, 1200],
      holds: [300, 900],
    }),

  'extension-lombaire-sol': () => {
    const hands = (spec: PoseSpec) =>
      behindHead({
        ...spec,
        fold: { upperArmL: 0.55, upperArmR: 0.55 },
        bend: { handL: -1, handR: -1 },
      });
    return move({
      key: 'extension-lombaire-sol',
      label: 'Extension lombaire au sol',
      description:
        'Extension lombaire au sol : à plat ventre, mains près des tempes, on décolle la poitrine du sol en gardant le regard vers le sol, puis on redescend.',
      view: 'profil',
      muscles: ['lombaires'],
      guides: { path: 'neck' },
      scene: mat(-100, 80),
      keys: [
        hands({ trunk: 90, neck: -8, ankle: -88, feet: 'free', anchor: on('pelvis', 0, 9.5) }),
        hands({
          trunk: 86,
          spine: -24,
          neck: -4,
          ankle: -88,
          feet: 'free',
          anchor: on('pelvis', 0, 9.5),
          contacts: ['pelvis', 'kneeL', 'toeL'],
        }),
      ],
      ms: [1000, 1200],
      holds: [300, 700],
    });
  },

  'extension-lombaire-balle': () => {
    const c = pt(0, 32);
    const legs = { ankleL: pt(-74, 12), ankleR: pt(-74, 12) };
    const over = (trunk: number, spine: number) =>
      behindHead({
        trunk,
        spine,
        neck: -6,
        anchor: on('pelvis', -6, 68),
        reach: legs,
        feet: 'toes',
        contacts: ['pelvis', 'toeL', 'toeR'],
      });
    return move({
      key: 'extension-lombaire-balle',
      label: 'Extension lombaire sur ballon',
      description:
        'Extension lombaire sur ballon : à plat ventre sur le ballon, pointes de pieds au sol, on redresse le buste jusqu’à l’alignement avec les jambes, puis on redescend.',
      view: 'profil',
      muscles: ['lombaires'],
      guides: { path: 'neck', back: true },
      scene: ball(c, 32),
      keys: [over(128, 10), over(72, 0)],
      ms: [1200, 1200],
    });
  },

  'marche-sur-place': () => {
    const step = (side: 'L' | 'R') =>
      pose(
        side === 'L'
          ? {
              hipL: 42,
              kneeL: 62,
              ankleL: -10,
              shoulderL: -24,
              elbowL: 70,
              shoulderR: 30,
              elbowR: 70,
              anchor: on('ankleR', 0, ANKLE_Y),
            }
          : {
              hipR: 42,
              kneeR: 62,
              ankleR: -10,
              shoulderR: -24,
              elbowR: 70,
              shoulderL: 30,
              elbowL: 70,
              anchor: on('ankleL', 0, ANKLE_Y),
            },
      );
    return move({
      key: 'marche-sur-place',
      label: 'Marche sur place',
      description:
        'Marche sur place : on lève un genou puis l’autre, sans hâte, en balançant les bras coudes fléchis.',
      view: 'profil',
      muscles: ['quadriceps'],
      guides: { path: 'kneeL' },
      keys: [step('L'), step('R')],
      ms: 600,
      holds: [80, 80],
    });
  },

  'step-jack': () => {
    const base = { shoulder: 8, elbow: 6, anchor: ground(0) };
    return move({
      key: 'step-jack',
      label: 'Step jack',
      description:
        'Step jack, vu de face : on écarte un pied sur le côté en levant les bras au-dessus de la tête, sans sauter, on revient, puis de l’autre côté.',
      view: 'face',
      muscles: ['epaules', 'mollets'],
      guides: { path: 'handL' },
      keys: [
        pose({ hip: 2, ...base }),
        pose({ hipL: 24, hipR: 2, shoulder: 160, elbow: 10, anchor: ground(0) }),
        pose({ hip: 2, ...base }),
        pose({ hipR: 24, hipL: 2, shoulder: 160, elbow: 10, anchor: ground(0) }),
      ],
      loop: 'boucle',
      endIndex: 1,
      ms: 600,
    });
  },

  'genoux-hauts': () => {
    const stride = (side: 'L' | 'R') =>
      pose(
        side === 'L'
          ? {
              trunk: 4,
              hipL: 92,
              kneeL: 100,
              ankleL: -20,
              ankleR: -20,
              feet: { L: 'free', R: 'toes' },
              shoulderL: -40,
              elbowL: 90,
              shoulderR: 55,
              elbowR: 90,
              anchor: ground(0, 2),
            }
          : {
              trunk: 4,
              hipR: 92,
              kneeR: 100,
              ankleR: -20,
              ankleL: -20,
              feet: { R: 'free', L: 'toes' },
              shoulderR: -40,
              elbowR: 90,
              shoulderL: 55,
              elbowL: 90,
              anchor: ground(0, 2),
            },
      );
    return move({
      key: 'genoux-hauts',
      label: 'Genoux hauts',
      description:
        'Genoux hauts : course sur place, on monte les genoux à hauteur de hanche en alternance, sur l’avant du pied, bras actifs.',
      view: 'profil',
      muscles: ['quadriceps', 'abdominaux'],
      guides: { path: 'kneeL' },
      keys: [stride('L'), stride('R')],
      ms: 340,
      holds: [40, 40],
    });
  },

  'talons-fesses': () => {
    const stride = (side: 'L' | 'R') =>
      pose(
        side === 'L'
          ? {
              trunk: 6,
              hipL: -6,
              kneeL: 135,
              ankleL: -30,
              ankleR: -16,
              feet: { L: 'free', R: 'toes' },
              shoulderL: 40,
              elbowL: 90,
              shoulderR: -30,
              elbowR: 90,
              anchor: ground(0, 2),
            }
          : {
              trunk: 6,
              hipR: -6,
              kneeR: 135,
              ankleR: -30,
              ankleL: -16,
              feet: { R: 'free', L: 'toes' },
              shoulderR: 40,
              elbowR: 90,
              shoulderL: -30,
              elbowL: 90,
              anchor: ground(0, 2),
            },
      );
    return move({
      key: 'talons-fesses',
      label: 'Talons-fesses',
      description:
        'Talons-fesses : course sur place, on ramène les talons vers les fesses en alternance, genoux pointés vers le sol.',
      view: 'profil',
      muscles: ['ischio-jambiers'],
      guides: { path: 'heelL' },
      keys: [stride('L'), stride('R')],
      ms: 340,
      holds: [40, 40],
    });
  },

  burpee: () => {
    const hands = { handL: pt(42, PALM_Y), handR: pt(42, PALM_Y) };
    const stand = pose({ shoulder: 6, anchor: FEET });
    const crouch = pose({
      trunk: 40,
      hip: 128,
      knee: 130,
      ankle: 40,
      feet: 'toes',
      neck: -20,
      anchor: FEET,
      reach: hands,
      grip: 'paume',
    });
    const plank = highPlankAt(42);
    return move({
      key: 'burpee',
      label: 'Burpee',
      description:
        'Burpee sans saut : depuis la position debout, on s’accroupit mains au sol, on recule les pieds en planche, on revient accroupi, puis on se relève.',
      view: 'profil',
      muscles: ['quadriceps', 'pectoraux', 'abdominaux'],
      guides: { path: 'pelvis' },
      scene: mat(-110, 70),
      keys: [
        { pose: stand, hold: 250 },
        { pose: crouch },
        { pose: plank, hold: 250 },
        { pose: crouch },
      ],
      loop: 'boucle',
      endIndex: 2,
      ms: [700, 600, 600, 700],
    });
  },
};
