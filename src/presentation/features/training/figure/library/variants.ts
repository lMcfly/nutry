/**
 * Poses dédiées : mêmes gestes que d'autres mouvements, mais avec une position, un appui ou un
 * matériel qui change vraiment ce qu'on voit (tirage assis sur une chaise avec une serviette,
 * extension des triceps au mur ou sur une table, curl sous une table, écarté au sol, appuis sur
 * un ballon, sliders, squat sumo…). Elles servent à ce que le mannequin montre exactement
 * l'exercice du catalogue, jamais la pose d'un exercice voisin.
 */
import type { Pose } from '../rig';
import { jointOf, move } from './build';
import { supine } from './helpers';
import { ANKLE_Y, KNEE_Y, PALM_Y, ground, on, pose, pt } from './pose';
import type { PoseSpec } from './pose';
import { anchorAt, ball, band, inclineBench, item, mat, pulley, table, wall } from './scene';
import { tune } from './tune';
import type { MovementFactory } from './types';

/** Chaise vue de face : assise, deux pieds, dossier. */
const chairFront = (seat: number) => [
  item('chaise', { kind: 'frame', a: pt(-21, 0.8), b: pt(-21, seat - 2), r: 1.6 }),
  item('chaise', { kind: 'frame', a: pt(21, 0.8), b: pt(21, seat - 2), r: 1.6 }),
  item('chaise', { kind: 'frame', a: pt(-21, seat), b: pt(-21, seat + 44), r: 1.6 }),
  item('chaise', { kind: 'frame', a: pt(21, seat), b: pt(21, seat + 44), r: 1.6 }),
  item('chaise', { kind: 'frame', a: pt(-21, seat + 42), b: pt(21, seat + 42), r: 1.6 }),
  item('chaise', { kind: 'pad', a: pt(-23, seat - 2), b: pt(23, seat - 2), r: 2.8 }, true),
];

/** Assis sur une chaise, vu de face : cuisses vers le spectateur (raccourcies), tibias droits. */
const sitFront = (spec: Partial<PoseSpec>): Pose =>
  pose({
    hip: 6,
    knee: 6,
    fold: { thighL: 0.62, thighR: 0.62, shinL: 0.8, shinR: 0.8 },
    anchor: on('pelvis', 0, 66),
    contacts: ['pelvis'],
    ...spec,
  });

export const VARIANTS: Record<string, MovementFactory> = {
  'tirage-vertical-serviette': () =>
    move({
      key: 'tirage-vertical-serviette',
      label: 'Tirage vertical à la serviette',
      description:
        'Tirage vertical à la serviette, vu de face : assis sur une chaise, dos droit, on tient une serviette tendue à deux mains au-dessus de la tête, puis on la descend vers le haut de la poitrine en écartant les coudes, sans aucune poulie.',
      view: 'face',
      muscles: ['dos', 'biceps'],
      guides: { path: 'handL' },
      grip: 'pronation',
      scene: chairFront(57),
      loads: [{ kind: 'serviette', at: 'hands' }],
      keys: [
        sitFront({ shoulder: 160, elbow: 14 }),
        sitFront({ shoulder: 78, elbow: 98, neck: 0 }),
      ],
      ms: [1300, 1400],
      holds: [400, 500],
    }),

  'tirage-vertical-elastique': () => {
    // À genoux face à un point d'attache haut : l'élastique descend de l'ancrage vers les mains.
    const kneel = (spec: Partial<PoseSpec>) =>
      pose({
        trunk: 0,
        hip: 0,
        knee: 90,
        ankle: -84,
        feet: 'free',
        anchor: on('kneeL', 0, KNEE_Y),
        grip: 'pronation',
        ...spec,
      });
    const sh = jointOf(kneel({}), 'shoulderL');
    const anchor = pt(sh.x + 34, 196);
    return move({
      key: 'tirage-vertical-elastique',
      label: 'Tirage vertical à l’élastique',
      description:
        'Tirage vertical à l’élastique : à genoux, face à un élastique accroché en hauteur, bras tendus vers le haut, on tire les mains vers le haut de la poitrine en abaissant les coudes, puis on remonte lentement.',
      view: 'profil',
      muscles: ['dos', 'biceps'],
      guides: { path: 'handL' },
      scene: [...band({ joint: 'handL' }, anchor), ...anchorAt(anchor)],
      keys: [
        kneel({ reach: { handL: pt(sh.x + 18, sh.y + 52), handR: pt(sh.x + 18, sh.y + 52) } }),
        kneel({
          trunk: -6,
          reach: { handL: pt(sh.x + 10, sh.y + 2), handR: pt(sh.x + 10, sh.y + 2) },
        }),
      ],
      ms: [1200, 1300],
    });
  },

  'extension-triceps-mur': () => {
    // Mains rapprochées à hauteur du front : le front descend vers le mur, les coudes restent en avant.
    const wallX = 112;
    const base = (trunk: number) =>
      pose({ trunk, ankle: trunk - 82, anchor: on('toeL', 0, 0), grip: 'paume' });
    const top = tune((t) => jointOf(base(t), 'shoulderL').x, wallX - 60, 5, 60);
    const down = tune((t) => jointOf(base(t), 'shoulderL').x, wallX - 34, 5, 70);
    const sh = jointOf(base(top), 'shoulderL');
    const hands = { handL: pt(wallX - 2.6, sh.y + 22), handR: pt(wallX - 2.6, sh.y + 22) };
    return move({
      key: 'extension-triceps-mur',
      label: 'Extension des triceps au mur',
      description:
        'Extension des triceps au mur : face au mur, mains rapprochées à hauteur du front, corps aligné, on plie les coudes vers l’avant pour approcher le front du mur, sans écarter les coudes, puis on tend les bras.',
      view: 'profil',
      muscles: ['triceps'],
      guides: { path: 'neck', back: true },
      scene: wall(wallX, 1),
      keys: [
        { ...base(top), reach: hands },
        { ...base(down), reach: hands },
      ],
      ms: [1200, 1100],
    });
  },

  'extension-triceps-table': () => {
    // Mains rapprochées sur le bord d'une table : le front descend sous le niveau du bord.
    const handY = 76;
    const base = (trunk: number) =>
      pose({ trunk, ankle: trunk - 82, anchor: on('toeL', 0, 0), grip: 'paume' });
    const upT = tune((t) => jointOf(base(t), 'shoulderL').y, handY + 55, 20, 89);
    const downT = tune((t) => jointOf(base(t), 'shoulderL').y, handY + 20, 20, 89);
    const sh = jointOf(base(upT), 'shoulderL');
    const hands = { handL: pt(sh.x + 6, handY + PALM_Y), handR: pt(sh.x + 6, handY + PALM_Y) };
    return move({
      key: 'extension-triceps-table',
      label: 'Extension des triceps sur une table',
      description:
        'Extension des triceps sur une table : mains rapprochées sur le bord d’une table stable, corps aligné en planche inclinée, on plie les coudes vers l’avant pour descendre le front sous le bord de la table, puis on tend les bras.',
      view: 'profil',
      muscles: ['triceps'],
      guides: { path: 'neck', back: true },
      scene: table(sh.x - 14, sh.x + 52, handY),
      keys: [
        { ...base(upT), reach: hands },
        { ...base(downT), reach: hands },
      ],
      ms: [1200, 1100],
    });
  },

  'curl-sous-table': () => {
    // Allongé sous une table, mains sur le bord (paumes vers soi), talons au sol : poitrine vers la table.
    const heel = on('heelL', 78, 0);
    const body = (trunk: number) => pose({ trunk, ankle: 12, anchor: heel, grip: 'supination' });
    const sh = jointOf(body(-62), 'shoulderL');
    const edge = pt(sh.x + 4, sh.y + 52);
    const upT = tune((t) => jointOf(body(t), 'shoulderL').y, edge.y - 20, -80, -30);
    const hands = { handL: edge, handR: edge };
    return move({
      key: 'curl-sous-table',
      label: 'Curl biceps sous une table',
      description:
        'Curl biceps au poids du corps : allongé sous une table solide, mains sur le bord paumes vers soi, corps tendu et talons au sol, on fléchit les coudes pour amener la poitrine vers la table, puis on redescend.',
      view: 'profil',
      muscles: ['biceps'],
      guides: { path: 'neck', back: true },
      scene: table(edge.x - 16, edge.x + 48, edge.y + 3),
      keys: [
        { ...body(-62), reach: hands },
        { ...body(upT), reach: hands },
      ],
      ms: [1100, 1300],
    });
  },

  'curl-incline': () => {
    // Assis dos plaqué sur un banc incliné, bras pendants en arrière du buste.
    const incline = 55;
    const seatTop = 45;
    const trunk = -(90 - incline);
    const pelvis = pt(0, seatTop + 10.5);
    const legs = { ankleL: pt(42, ANKLE_Y), ankleR: pt(42, ANKLE_Y) };
    const sit = (reach: Pose['reach']) =>
      pose({
        trunk,
        neck: -6,
        anchor: on('pelvis', pelvis.x, pelvis.y),
        grip: 'supination',
        reach: { ...legs, ...reach },
      });
    const sh = jointOf(sit({}), 'shoulderL');
    const rad = (trunk * Math.PI) / 180;
    const up = pt(Math.sin(rad), Math.cos(rad));
    const pivot = pt(pelvis.x - up.x * 10.5, pelvis.y - up.y * 10.5);
    return move({
      key: 'curl-incline',
      label: 'Curl incliné',
      description:
        'Curl incliné aux haltères : assis dos plaqué sur un banc incliné, bras pendants derrière le buste, on fléchit les coudes pour monter les haltères vers les épaules sans avancer les coudes, puis on redescend.',
      view: 'profil',
      muscles: ['biceps'],
      guides: { path: 'handL' },
      scene: inclineBench(pt(pivot.x, pivot.y - 2), incline, 1, 62, 30),
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [
        sit({ handL: pt(sh.x - 2, sh.y - 54), handR: pt(sh.x - 2, sh.y - 54) }),
        sit({ handL: pt(sh.x + 17, sh.y - 6), handR: pt(sh.x + 17, sh.y - 6) }),
      ],
      ms: [1000, 1400],
    });
  },

  'elevation-laterale-poulie': () => {
    // De face, à côté d'une poulie basse : le câble traverse le corps jusqu'à la main éloignée.
    const wheel = pt(-52, 14);
    return move({
      key: 'elevation-laterale-poulie',
      label: 'Élévation latérale à la poulie',
      description:
        'Élévation latérale à la poulie, vue de face : debout à côté d’une poulie basse, poignée dans la main éloignée, bras légèrement fléchi, on lève le bras sur le côté jusqu’à hauteur d’épaule, puis on redescend.',
      view: 'face',
      muscles: ['epaules'],
      guides: { path: 'handL' },
      grip: { L: 'neutre', R: 'plat' },
      scene: pulley(-56, wheel, { joint: 'handL' }, 90),
      keys: [
        pose({ hip: 5, shoulderL: 12, elbowL: 4, shoulderR: 6, anchor: ground(0) }),
        pose({ hip: 5, shoulderL: 88, elbowL: 4, shoulderR: 6, anchor: ground(0) }),
      ],
      ms: [1100, 1400],
    });
  },

  'ecarte-sol': () => {
    // Allongé au sol, genoux fléchis : les coudes descendent jusqu'au sol (bras vus en raccourci).
    const legs = { ankleL: pt(32, ANKLE_Y), ankleR: pt(32, ANKLE_Y) };
    const lying = (fold: number) =>
      pose({
        trunk: -90,
        neck: 6,
        shoulder: 92,
        elbow: 14,
        fold: { upperArmL: fold, upperArmR: fold, forearmL: fold, forearmR: fold },
        anchor: on('neck', -46, 9.5),
        reach: legs,
        grip: 'neutre',
      });
    return move({
      key: 'ecarte-sol',
      label: 'Écarté au sol',
      description:
        'Écarté au sol : allongé sur le dos, genoux fléchis, haltères au-dessus de la poitrine, on ouvre les bras sur les côtés en arc jusqu’à ce que les coudes touchent le sol, puis on les referme.',
      view: 'profil',
      muscles: ['pectoraux'],
      guides: { path: 'handL' },
      scene: mat(-80, 50),
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [lying(1), lying(0.2)],
      ms: [1400, 1200],
    });
  },

  'squat-sumo': () => {
    // De face : pieds très écartés, pointes vers l'extérieur ; les cuisses viennent vers soi.
    const stance = (hip: number, fold: number, y: number) =>
      pose({
        hip,
        knee: hip,
        shoulder: 70,
        elbow: 120,
        fold: { thighL: fold, thighR: fold, shinL: 0.8, shinR: 0.8 },
        anchor: on('pelvis', 0, y),
        grip: 'neutre',
        feet: 'flat',
      });
    // Le bassin est posé à la hauteur qui amène les pieds juste au sol.
    const grounded = (hip: number, fold: number) =>
      stance(
        hip,
        fold,
        tune((y) => jointOf(stance(hip, fold, y), 'ankleL', 'face').y, ANKLE_Y, 20, 110),
      );
    return move({
      key: 'squat-sumo',
      label: 'Squat sumo',
      description:
        'Squat sumo, vu de face : pieds bien plus larges que les épaules, pointes tournées vers l’extérieur, on descend en fléchissant les genoux au-dessus des pieds, buste droit, puis on remonte en serrant les fessiers.',
      view: 'face',
      muscles: ['quadriceps', 'fessiers'],
      guides: { path: 'pelvis' },
      keys: [grounded(22, 1), grounded(44, 0.7)],
      ms: [1300, 1100],
    });
  },

  'crunch-swiss-ball': () => {
    // Bas du dos appuyé sur le ballon, pieds ancrés au sol, mains près des tempes.
    const ballC = pt(-4, 30);
    const legs = { ankleL: pt(46, ANKLE_Y), ankleR: pt(46, ANKLE_Y) };
    const lean = (trunk: number, spine: number, neck: number) =>
      pose({
        trunk,
        spine,
        neck,
        knee: 90,
        anchor: on('pelvis', 4, 46),
        reach: legs,
        grip: 'nuque',
      });
    return move({
      key: 'crunch-swiss-ball',
      label: 'Crunch sur ballon',
      description:
        'Crunch sur ballon : bas du dos appuyé sur le ballon, pieds bien ancrés, mains près des tempes, on enroule le buste en contractant le ventre, puis on redescend en s’étirant sur le ballon.',
      view: 'profil',
      muscles: ['abdominaux'],
      guides: { path: 'neck' },
      scene: ball(ballC, 30),
      keys: [lean(-62, 0, 10), lean(-34, 30, 24)],
      ms: [1000, 1200],
      holds: [300, 450],
    });
  },

  'planche-swiss-ball': () => {
    // Avant-bras sur le ballon, pieds au sol : corps aligné de la tête aux talons.
    const top = 62;
    const plank = (trunk: number) =>
      pose({
        trunk,
        shoulder: trunk,
        elbow: 90,
        ankle: trunk - 80,
        anchor: on('elbowL', 0, top + 4.5),
        grip: 'plat',
      });
    const trunk = tune((t) => jointOf(plank(t), 'toeL').y, 0, 50, 89);
    return move({
      key: 'planche-swiss-ball',
      label: 'Planche sur ballon',
      description:
        'Planche sur ballon : avant-bras posés sur le ballon, coudes sous les épaules, pointes de pieds au sol, corps aligné de la tête aux talons, ventre et fessiers serrés, on tient la position.',
      view: 'profil',
      muscles: ['abdominaux', 'epaules'],
      guides: { back: true },
      scene: ball(pt(8, 31), 31),
      keys: [plank(trunk), plank(trunk + 1.5)],
      ms: [1400, 1400],
      holds: [500, 2000],
    });
  },

  'curl-ischio-sliders': () => {
    // Pont fessier, talons sur des sliders (ou des serviettes) au sol : on les fait glisser vers les fesses.
    const neck = pt(-60, 9.5);
    const heels = (x: number) => ({ ankleL: pt(x, ANKLE_Y + 1), ankleR: pt(x, ANKLE_Y + 1) });
    const bridge = (x: number) =>
      supine({ trunk: -120, shoulder: -24, ankle: 10, feet: 'free', reach: heels(x) }, neck);
    return move({
      key: 'curl-ischio-sliders',
      label: 'Curl ischio sur sliders',
      description:
        'Curl ischio sur sliders : allongé sur le dos, bassin levé, talons sur des sliders ou des serviettes posés sur un sol lisse, on fait glisser les talons vers les fesses en gardant le bassin haut, puis on les écarte lentement.',
      view: 'profil',
      muscles: ['ischio-jambiers', 'fessiers'],
      guides: { path: 'ankleL' },
      grip: 'plat',
      scene: [
        item('sliders', {
          kind: 'pad',
          a: { joint: 'ankleL', dx: -5, dy: -5 },
          b: { joint: 'ankleL', dx: 6, dy: -5 },
          r: 1.6,
        }),
      ],
      keys: [bridge(84), bridge(40)],
      ms: [1300, 1300],
    });
  },
};
