/**
 * Machines de salle, dessinées avec le même petit jeu de pièces : siège et dossier (coussins),
 * montants et rails (tubes), bras de levier qui suit la poignée ou le boudin, pile de plaques,
 * câble. Chaque machine se compose en quelques lignes.
 */
import type { SceneItem } from '../equipment';
import type { Pose } from '../rig';
import { jointOf, move } from './build';
import { FEET, offset, torsoFrame } from './helpers';
import { barOnBack } from './legs2';
import { ANKLE_Y, on, pose, pt } from './pose';
import type { PoseSpec } from './pose';
import { machine } from './scene';
import type { MovementFactory } from './types';

const { pad, frame, arm, roller, stack, wheel } = machine;

/** Siège droit : assise, dossier, piétement, colonne et pile de plaques derrière. */
function seat(seatTop = 46, backX = -14, backHeight = 62, column = -40): SceneItem[] {
  return [
    frame(pt(column, 0.8), pt(column, 170), 2.4),
    stack(column + 14, 34),
    frame(pt(column - 8, 0.8), pt(30, 0.8), 1.2),
    frame(pt(4, 0.8), pt(4, seatTop - 6), 2),
    frame(pt(backX - 4, seatTop - 4), pt(backX - 4, seatTop + backHeight - 8), 1.6),
    pad(pt(-12, seatTop - 3.2), pt(24, seatTop - 3.2), 3.2),
    pad(pt(backX, seatTop + 6), pt(backX, seatTop + backHeight), 3.6),
  ];
}

/** Dossier le long du dos d'une pose (incliné avec le tronc). */
function backPad(p: Pose, gap = 12.5, from = 0.05, to = 0.95): SceneItem {
  const pelvis = jointOf(p, 'pelvis');
  const neck = jointOf(p, 'neck');
  const tilt = p.angles.trunk;
  const { front } = torsoFrame(tilt);
  const back = pt(-front.x, -front.y);
  const a = pt(pelvis.x + (neck.x - pelvis.x) * from, pelvis.y + (neck.y - pelvis.y) * from);
  const b = pt(pelvis.x + (neck.x - pelvis.x) * to, pelvis.y + (neck.y - pelvis.y) * to);
  return pad(offset(a, back, gap), offset(b, back, gap), 3.6);
}

/** Assis sur le siège ; pieds à plat devant, sauf si la pose règle les jambes elle-même. */
const sitting = (spec: Partial<PoseSpec>, seatTop = 46): Pose =>
  pose({
    trunk: -6,
    anchor: on('pelvis', 0, seatTop + 10.5),
    ...spec,
    reach:
      spec.hip === undefined
        ? { ankleL: pt(40, ANKLE_Y), ankleR: pt(40, ANKLE_Y), ...spec.reach }
        : (spec.reach ?? {}),
  });

/** Presse à cuisses : dossier incliné, plateforme sur un rail à 45°. */
function legPress(
  ankle: { x: number; y: number },
  foot: number,
  extra: Partial<PoseSpec> = {},
): Pose {
  return pose({
    trunk: -58,
    neck: 30,
    anchor: on('pelvis', 0, 34),
    reach: { ankleL: ankle, ankleR: ankle },
    feet: foot,
    shoulder: 30,
    elbow: 20,
    grip: 'neutre',
    contacts: ['pelvis', 'heelL'],
    ...extra,
  });
}

function legPressScene(p: Pose): SceneItem[] {
  return [
    backPad(p, 12, -0.1, 0.9),
    pad(pt(-16, 22), pt(10, 22), 3.2),
    frame(pt(-30, 0.8), pt(-4, 19), 2),
    frame(pt(-40, 0.8), pt(112, 0.8), 1.2),
    frame(pt(22, 22), pt(104, 104), 2.2),
    frame(pt(104, 0.8), pt(104, 104), 2),
    // Plateforme : suit les pieds, perpendiculaire au rail.
    pad({ joint: 'heelL', dx: 5.3, dy: -0.3 }, { joint: 'toeL', dx: -0.3, dy: 5.3 }, 2.4),
  ];
}

export const MACHINES: Record<string, MovementFactory> = {
  'presse-cuisses': () => {
    const start = legPress(pt(38, 74), -135);
    return move({
      key: 'presse-cuisses',
      label: 'Presse à cuisses',
      description:
        'Presse à cuisses : dos et bassin plaqués au dossier, pieds à plat sur la plateforme, on fléchit les genoux vers la poitrine puis on pousse sans verrouiller les genoux.',
      view: 'profil',
      muscles: ['quadriceps', 'fessiers'],
      guides: { path: 'ankleL' },
      scene: legPressScene(start),
      keys: [legPress(pt(58, 82), -135), start],
      ms: [1300, 1100],
    });
  },

  'mollets-presse': () => {
    const p = legPress(pt(60, 84), -135);
    return move({
      key: 'mollets-presse',
      label: 'Mollets à la presse',
      description:
        'Mollets à la presse : jambes presque tendues, seul l’avant du pied sur le bas de la plateforme, on pousse avec les pointes en tendant les chevilles, puis on revient.',
      view: 'profil',
      muscles: ['mollets'],
      guides: { path: 'toeL' },
      scene: legPressScene(p),
      keys: [p, legPress(pt(61, 85), -108, { contacts: ['pelvis', 'toeL'] })],
      ms: [800, 1100],
    });
  },

  'leg-extension': () => {
    const start = sitting({
      hip: 84,
      knee: 90,
      ankle: -10,
      feet: 'free',
      grip: 'neutre',
      reach: { handL: pt(10, 50), handR: pt(10, 50) },
    });
    const knee = jointOf(start, 'kneeL');
    return move({
      key: 'leg-extension',
      label: 'Leg extension',
      description:
        'Leg extension : assis, dos au dossier, boudin sur le bas des tibias, on tend les jambes jusqu’à l’horizontale puis on redescend lentement.',
      view: 'profil',
      muscles: ['quadriceps'],
      guides: { path: 'ankleL' },
      scene: [
        ...seat(),
        frame(pt(knee.x, 0.8), knee, 2),
        arm(knee, { joint: 'ankleL', seg: 'shinL', along: -3, front: 7 }),
        roller({ joint: 'ankleL', seg: 'shinL', along: -3, front: 7 }, 3.8),
      ],
      keys: [
        start,
        sitting({
          hip: 84,
          knee: 4,
          ankle: -10,
          feet: 'free',
          grip: 'neutre',
          reach: { handL: pt(10, 50), handR: pt(10, 50) },
        }),
      ],
      ms: [1100, 1300],
    });
  },

  'leg-curl-assis': () => {
    const start = sitting({
      hip: 84,
      knee: 4,
      ankle: -6,
      feet: 'free',
      grip: 'neutre',
      reach: { handL: pt(14, 54), handR: pt(14, 54) },
    });
    const knee = jointOf(start, 'kneeL');
    return move({
      key: 'leg-curl-assis',
      label: 'Leg curl assis',
      description:
        'Leg curl assis : cuisses bloquées sous le coussin, boudin derrière les chevilles, on fléchit les genoux pour amener les talons sous le siège, puis on tend lentement.',
      view: 'profil',
      muscles: ['ischio-jambiers'],
      guides: { path: 'ankleL' },
      scene: [
        ...seat(),
        pad(pt(knee.x - 22, knee.y + 10), pt(knee.x - 4, knee.y + 10), 3.2),
        frame(pt(knee.x, 0.8), knee, 2),
        arm(knee, { joint: 'ankleL', seg: 'shinL', along: -2, front: -7 }),
        roller({ joint: 'ankleL', seg: 'shinL', along: -2, front: -7 }, 3.8),
      ],
      keys: [
        start,
        sitting({
          hip: 84,
          knee: 108,
          ankle: -6,
          feet: 'free',
          grip: 'neutre',
          reach: { handL: pt(14, 54), handR: pt(14, 54) },
        }),
      ],
      ms: [1100, 1300],
    });
  },

  'leg-curl-allonge': () => {
    const top = 62;
    const lying = (knee: number) =>
      pose({
        trunk: 90,
        neck: -6,
        knee,
        ankle: -60,
        feet: 'free',
        shoulder: 100,
        elbow: 40,
        anchor: on('pelvis', 0, top + 9.5),
        grip: 'neutre',
        contacts: ['pelvis'],
      });
    const knee = jointOf(lying(0), 'kneeL');
    return move({
      key: 'leg-curl-allonge',
      label: 'Leg curl allongé',
      description:
        'Leg curl allongé : à plat ventre sur la machine, boudin au-dessus des talons, on ramène les talons vers les fesses, hanches plaquées, puis on redescend lentement.',
      view: 'profil',
      muscles: ['ischio-jambiers'],
      guides: { path: 'heelL' },
      scene: [
        pad(pt(knee.x + 2, top - 3), pt(70, top - 3), 3.2),
        frame(pt(20, 0.8), pt(20, top - 6), 2),
        frame(pt(knee.x, 0.8), pt(knee.x, knee.y - 4), 2),
        frame(pt(-10, 0.8), pt(80, 0.8), 1.2),
        arm(knee, { joint: 'ankleL', seg: 'shinL', along: -2, front: -7 }),
        roller({ joint: 'ankleL', seg: 'shinL', along: -2, front: -7 }, 3.8),
      ],
      keys: [lying(2), lying(110)],
      ms: [1100, 1300],
    });
  },

  'developpe-pectoral-machine': () => {
    const base = sitting({});
    const sh = jointOf(base, 'shoulderL');
    const pivot = pt(sh.x - 6, sh.y + 52);
    const at = (dx: number) => pt(sh.x + dx, sh.y - 4);
    return move({
      key: 'developpe-pectoral-machine',
      label: 'Développé pectoral à la machine',
      description:
        'Développé pectoral à la machine : assis, dos plaqué, poignées à hauteur de poitrine, on pousse les bras vers l’avant sans verrouiller les coudes, puis on revient.',
      view: 'profil',
      muscles: ['pectoraux', 'triceps'],
      guides: { path: 'handL' },
      grip: 'neutre',
      scene: [
        ...seat(),
        frame(pt(-40, sh.y + 52), pivot, 2),
        arm(pivot, { joint: 'handL' }),
        wheel(pivot, 3),
      ],
      keys: [
        sitting({ reach: { handL: at(16), handR: at(16) } }),
        sitting({ reach: { handL: at(54), handR: at(54) } }),
      ],
      ms: [1100, 1300],
    });
  },

  'butterfly-machine': () => {
    const sit = (abduction: number, fold: number) =>
      pose({
        shoulder: abduction,
        elbow: 90,
        hip: 12,
        knee: 0,
        fold: { upperArmL: fold, upperArmR: fold, thighL: 0.35, thighR: 0.35 },
        anchor: on('pelvis', 0, 56),
        reach: { ankleL: pt(16, ANKLE_Y), ankleR: pt(-16, ANKLE_Y) },
        grip: 'neutre',
        contacts: ['pelvis'],
      });
    return move({
      key: 'butterfly-machine',
      label: 'Butterfly à la machine',
      description:
        'Butterfly, vu de face : assis dos plaqué, avant-bras contre les appuis, coudes à hauteur d’épaules, on rapproche les bras devant la poitrine, puis on rouvre lentement.',
      view: 'face',
      muscles: ['pectoraux'],
      guides: { path: 'elbowL' },
      scene: [
        pad(pt(-15, 66), pt(15, 66), 14),
        pad(pt(-15, 100), pt(15, 100), 14),
        frame(pt(0, 0.8), pt(0, 44), 2),
        frame(pt(-30, 0.8), pt(30, 0.8), 1.2),
        pad({ joint: 'elbowL' }, { joint: 'wristL' }, 3.4),
        pad({ joint: 'elbowR' }, { joint: 'wristR' }, 3.4),
      ],
      keys: [sit(88, 1), sit(70, 0.34)],
      ms: [1200, 1300],
    });
  },

  'developpe-epaules-machine': () => {
    const base = sitting({ trunk: -4 });
    const sh = jointOf(base, 'shoulderL');
    const pivot = pt(sh.x - 34, sh.y + 6);
    return move({
      key: 'developpe-epaules-machine',
      label: 'Développé épaules à la machine',
      description:
        'Développé épaules à la machine : assis dos plaqué, poignées à hauteur d’épaules, on pousse vers le haut sans cambrer, puis on redescend jusqu’aux épaules.',
      view: 'profil',
      muscles: ['epaules', 'triceps'],
      guides: { path: 'handL' },
      grip: 'pronation',
      scene: [...seat(46, -14, 80), arm(pivot, { joint: 'handL' }), wheel(pivot, 3)],
      keys: [
        sitting({
          trunk: -4,
          reach: { handL: pt(sh.x + 8, sh.y + 4), handR: pt(sh.x + 8, sh.y + 4) },
        }),
        sitting({
          trunk: -4,
          reach: { handL: pt(sh.x + 6, sh.y + 55), handR: pt(sh.x + 6, sh.y + 55) },
        }),
      ],
      ms: [1200, 1200],
    });
  },

  'rowing-machine': () => {
    const base = sitting({ trunk: 8 });
    const sh = jointOf(base, 'shoulderL');
    const pivot = pt(sh.x + 66, 30);
    const chest = jointOf(base, 'neck');
    return move({
      key: 'rowing-machine',
      label: 'Rowing à la machine',
      description:
        'Rowing à la machine : assis, poitrine contre l’appui, on tire les poignées en ramenant les coudes vers l’arrière et en serrant les omoplates, puis on tend les bras.',
      view: 'profil',
      muscles: ['dos', 'biceps'],
      guides: { path: 'handL' },
      grip: 'neutre',
      scene: [
        pad(pt(-12, 42.8), pt(24, 42.8), 3.2),
        frame(pt(4, 0.8), pt(4, 40), 2),
        frame(pt(-20, 0.8), pt(pivot.x + 6, 0.8), 1.2),
        frame(pt(chest.x + 30, 0.8), pt(chest.x + 30, chest.y - 10), 2),
        pad(pt(chest.x + 18, chest.y - 40), pt(chest.x + 18, chest.y - 6), 3.6),
        frame(pt(pivot.x, 0.8), pivot, 2),
        arm(pivot, { joint: 'handL' }),
      ],
      keys: [
        sitting({
          trunk: 8,
          reach: { handL: pt(sh.x + 54, sh.y - 8), handR: pt(sh.x + 54, sh.y - 8) },
        }),
        sitting({
          trunk: 4,
          reach: { handL: pt(sh.x + 8, sh.y - 16), handR: pt(sh.x + 8, sh.y - 16) },
        }),
      ],
      ms: [1100, 1300],
    });
  },

  'abduction-machine': () => {
    const sit = (hip: number) =>
      pose({
        hip,
        knee: hip,
        shoulder: 10,
        elbow: 30,
        fold: { thighL: 0.34, thighR: 0.34, shinL: 0.87, shinR: 0.87 },
        anchor: on('pelvis', 0, 56),
        grip: 'neutre',
        contacts: ['pelvis'],
      });
    return move({
      key: 'abduction-machine',
      label: 'Abduction à la machine',
      description:
        'Abduction à la machine, vue de face : assis, genoux contre les coussins extérieurs, on écarte les jambes puis on les referme lentement.',
      view: 'face',
      muscles: ['fessiers'],
      guides: { path: 'kneeL' },
      scene: [
        pad(pt(-16, 60), pt(16, 60), 13),
        pad(pt(-15, 100), pt(15, 100), 13),
        frame(pt(0, 0.8), pt(0, 44), 2),
        pad({ joint: 'kneeL', dx: 6, dy: 4 }, { joint: 'kneeL', dx: 6, dy: -8 }, 3),
        pad({ joint: 'kneeR', dx: -6, dy: 4 }, { joint: 'kneeR', dx: -6, dy: -8 }, 3),
      ],
      keys: [sit(4), sit(30)],
      ms: [1000, 1200],
    });
  },

  'adduction-machine': () => {
    const sit = (hip: number) =>
      pose({
        hip,
        knee: hip,
        shoulder: 10,
        elbow: 30,
        fold: { thighL: 0.34, thighR: 0.34, shinL: 0.87, shinR: 0.87 },
        anchor: on('pelvis', 0, 56),
        grip: 'neutre',
        contacts: ['pelvis'],
      });
    return move({
      key: 'adduction-machine',
      label: 'Adduction à la machine',
      description:
        'Adduction à la machine, vue de face : assis, jambes écartées contre les coussins intérieurs, on rapproche les genoux puis on les rouvre lentement.',
      view: 'face',
      muscles: ['fessiers'],
      guides: { path: 'kneeL' },
      scene: [
        pad(pt(-16, 60), pt(16, 60), 13),
        pad(pt(-15, 100), pt(15, 100), 13),
        frame(pt(0, 0.8), pt(0, 44), 2),
        pad({ joint: 'kneeL', dx: -6, dy: 4 }, { joint: 'kneeL', dx: -6, dy: -8 }, 3),
        pad({ joint: 'kneeR', dx: 6, dy: 4 }, { joint: 'kneeR', dx: 6, dy: -8 }, 3),
      ],
      keys: [sit(30), sit(4)],
      ms: [1000, 1200],
    });
  },

  'mollets-machine-debout': () => {
    const block = 10;
    const stand = (ankle: number) =>
      pose({
        ankle,
        anchor: on('toeL', 14, block),
        grip: 'pronation',
        shoulder: 150,
        elbow: 150,
        contacts: ['toeL', 'toeR'],
      });
    return move({
      key: 'mollets-machine-debout',
      label: 'Mollets à la machine debout',
      description:
        'Mollets à la machine debout : épaules sous les coussins, pointes de pieds au bord de la plateforme, talons dans le vide, on monte sur les pointes puis on redescend sous le niveau de la plateforme.',
      view: 'profil',
      muscles: ['mollets'],
      guides: { path: 'heelL' },
      scene: [
        machine.pad(pt(-6, block / 2), pt(14, block / 2), block / 2),
        frame(pt(-26, 0.8), pt(-26, 200), 2.4),
        stack(-40, 40),
        arm(pt(-26, 150), { joint: 'neck', dx: -6, dy: 3 }),
        pad({ joint: 'neck', dx: -12, dy: 2 }, { joint: 'neck', dx: 6, dy: 2 }, 3),
      ],
      keys: [stand(18), stand(-30)],
      ms: [800, 1100],
      holds: [300, 500],
    });
  },

  'mollets-machine-assis': () => {
    const legs = (y: number) => ({ ankleL: pt(43, y), ankleR: pt(43, y) });
    const sit = (y: number, mode: 'flat' | 'toes') =>
      pose({
        anchor: on('pelvis', 0, 56),
        reach: { ...legs(y), handL: pt(32, 82), handR: pt(32, 82) },
        feet: mode,
        grip: 'neutre',
      });
    return move({
      key: 'mollets-machine-assis',
      label: 'Mollets à la machine assis',
      description:
        'Mollets à la machine assis : genoux sous les coussins, pointes de pieds sur la plateforme, on monte les talons le plus haut possible, puis on les descend sous la plateforme.',
      view: 'profil',
      muscles: ['mollets'],
      guides: { path: 'kneeL' },
      scene: [
        ...seat(46, -14, 0),
        pad({ joint: 'kneeL', dx: -14, dy: 9 }, { joint: 'kneeL', dx: 4, dy: 9 }, 3),
        frame(pt(60, 0.8), pt(60, 90), 2),
        arm(pt(60, 72), { joint: 'kneeL', dx: 4, dy: 9 }),
      ],
      keys: [sit(ANKLE_Y, 'flat'), sit(14, 'toes')],
      ms: [800, 1100],
      holds: [300, 500],
    });
  },

  'traction-assistee-machine': () => {
    const handles = pt(10, 214);
    const kneel = (y: number) =>
      pose({
        hip: 0,
        knee: 92,
        ankle: -80,
        feet: 'free',
        anchor: on('kneeL', 0, y),
        reach: { handL: handles, handR: handles },
        grip: 'neutre',
        contacts: ['kneeL'],
      });
    return move({
      key: 'traction-assistee-machine',
      label: 'Traction assistée à la machine',
      description:
        'Traction assistée : à genoux sur le repose-genoux, mains aux poignées hautes, on tire les coudes vers les côtes jusqu’au menton au-dessus des poignées, puis on redescend.',
      view: 'profil',
      muscles: ['dos', 'biceps'],
      guides: { path: 'neck' },
      scene: [
        frame(pt(-30, 0.8), pt(-30, 226), 2.4),
        stack(-44, 40),
        frame(pt(-30, 222), pt(handles.x + 4, 222), 2),
        frame(handles, pt(handles.x, 222), 1.4),
        frame(pt(-30, 30), { joint: 'kneeL', dx: -8, dy: -7 }, 1.8),
        pad({ joint: 'kneeL', dx: -6, dy: -8 }, { joint: 'kneeL', dx: -30, dy: -8 }, 3),
      ],
      keys: [kneel(96), kneel(140)],
      ms: [1300, 1300],
    });
  },

  'dips-assistes': () => {
    const bars = pt(6, 128);
    const kneel = (y: number) =>
      pose({
        trunk: 6,
        hip: 4,
        knee: 92,
        ankle: -80,
        feet: 'free',
        anchor: on('kneeL', 0, y),
        reach: { handL: bars, handR: bars },
        grip: 'neutre',
        contacts: ['kneeL'],
      });
    return move({
      key: 'dips-assistes',
      label: 'Dips assistés',
      description:
        'Dips assistés : à genoux sur le repose-genoux, mains sur les poignées parallèles, on fléchit les coudes vers l’arrière pour descendre, buste légèrement penché, puis on pousse.',
      view: 'profil',
      muscles: ['triceps', 'pectoraux'],
      guides: { path: 'neck' },
      scene: [
        frame(pt(-30, 0.8), pt(-30, 200), 2.4),
        stack(-44, 40),
        frame(pt(-30, bars.y - 3), pt(bars.x + 8, bars.y - 3), 1.6),
        frame(pt(-30, 30), { joint: 'kneeL', dx: -8, dy: -7 }, 1.8),
        pad({ joint: 'kneeL', dx: -6, dy: -8 }, { joint: 'kneeL', dx: -30, dy: -8 }, 3),
      ],
      keys: [kneel(76), kneel(52)],
      ms: [1200, 1000],
    });
  },

  'crunch-machine': () => {
    const sit = (trunk: number, spine: number) => {
      const p = sitting({ trunk, spine, neck: 12 });
      const head = jointOf(p, 'head');
      const t = pt(head.x + 6, head.y - 4);
      return sitting({ trunk, spine, neck: 12, reach: { handL: t, handR: t }, grip: 'neutre' });
    };
    return move({
      key: 'crunch-machine',
      label: 'Crunch à la machine',
      description:
        'Crunch à la machine : assis, poignées près de la tête, on enroule le buste vers l’avant en contractant les abdominaux, puis on revient lentement.',
      view: 'profil',
      muscles: ['abdominaux'],
      guides: { path: 'head' },
      scene: [
        ...seat(46, -14, 30),
        arm(pt(-20, 150), { joint: 'handL' }),
        frame(pt(-40, 150), pt(-20, 150), 2),
      ],
      keys: [sit(-4, 0), sit(10, 44)],
      ms: [1000, 1300],
    });
  },

  hyperextension: () => {
    const legs = { ankleL: pt(-52, 22), ankleR: pt(-52, 22) };
    const lean = (trunk: number) => {
      const p = pose({
        trunk,
        neck: -6,
        anchor: on('pelvis', 0, 74),
        reach: legs,
        ankle: 8,
        feet: 'free',
        contacts: ['pelvis', 'heelL'],
      });
      const t = jointOf(p, 'neck');
      return pose({
        trunk,
        neck: -6,
        anchor: on('pelvis', 0, 74),
        reach: { ...legs, handL: t, handR: t },
        ankle: 8,
        feet: 'free',
        grip: 'nuque',
        contacts: ['pelvis', 'heelL'],
      });
    };
    return move({
      key: 'hyperextension',
      label: 'Hyperextension',
      description:
        'Hyperextension au banc à 45° : hanches calées sur le coussin, chevilles bloquées, on descend le buste dos plat, puis on remonte jusqu’à l’alignement avec les jambes, sans cambrer.',
      view: 'profil',
      muscles: ['lombaires', 'fessiers'],
      guides: { path: 'neck', back: true },
      scene: [
        pad(pt(4, 62), pt(14, 72), 4),
        roller({ joint: 'ankleL', dx: 3, dy: -6 }, 3.6),
        pad({ joint: 'heelL', dx: -2, dy: -2 }, { joint: 'toeL', dx: 2, dy: -2 }, 2),
        frame(pt(-60, 6), pt(10, 64), 2),
        frame(pt(-60, 0.8), pt(-60, 20), 2),
        frame(pt(10, 0.8), pt(10, 60), 2),
        frame(pt(-70, 0.8), pt(20, 0.8), 1.2),
      ],
      keys: [lean(150), lean(46)],
      ms: [1300, 1200],
    });
  },

  'hyperextension-inversee': () => {
    const top = 80;
    const lying = (hip: number) => {
      const p = pose({
        trunk: 90,
        neck: -6,
        hip,
        ankle: -60,
        feet: 'free',
        anchor: on('pelvis', 2, top + 9.5),
      });
      const sh = jointOf(p, 'shoulderL');
      return pose({
        trunk: 90,
        neck: -6,
        hip,
        ankle: -60,
        feet: 'free',
        anchor: on('pelvis', 2, top + 9.5),
        reach: { handL: pt(sh.x + 22, top - 4), handR: pt(sh.x + 22, top - 4) },
        grip: 'pronation',
        contacts: ['pelvis'],
      });
    };
    return move({
      key: 'hyperextension-inversee',
      label: 'Hyperextension inversée',
      description:
        'Hyperextension inversée : à plat ventre sur le banc, hanches au bord, mains agrippées, on monte les jambes tendues jusqu’à l’alignement avec le buste, puis on redescend.',
      view: 'profil',
      muscles: ['fessiers', 'lombaires'],
      guides: { path: 'ankleL' },
      scene: [
        pad(pt(4, top - 3.4), pt(80, top - 3.4), 3.4),
        frame(pt(14, 0.8), pt(14, top - 6), 2),
        frame(pt(70, 0.8), pt(70, top - 6), 2),
        frame(pt(0, 0.8), pt(86, 0.8), 1.2),
      ],
      keys: [lying(64), lying(-2)],
      ms: [1100, 1200],
    });
  },

  'extension-lombaire-machine': () => {
    const sit = (trunk: number) => {
      const p = sitting({ trunk, neck: -trunk * 0.4 });
      const sh = jointOf(p, 'shoulderL');
      return sitting({
        trunk,
        neck: -trunk * 0.4,
        reach: { handL: pt(sh.x + 10, sh.y - 20), handR: pt(sh.x + 10, sh.y - 20) },
        grip: 'neutre',
      });
    };
    return move({
      key: 'extension-lombaire-machine',
      label: 'Extension lombaire à la machine',
      description:
        'Extension lombaire à la machine : assis, haut du dos contre le coussin, on pousse le dos vers l’arrière jusqu’à la verticale, sans à-coup, puis on revient.',
      view: 'profil',
      muscles: ['lombaires'],
      guides: { path: 'neck', back: true },
      scene: [
        ...seat(46, -14, 0),
        arm(pt(-14, 56), { joint: 'neck', seg: 'torso', along: -10, front: -13 }),
        roller({ joint: 'neck', seg: 'torso', along: -10, front: -13 }, 4.2),
      ],
      keys: [sit(36), sit(-6)],
      ms: [1300, 1200],
    });
  },

  'reverse-fly-machine': () => {
    const sit = (abduction: number, fold: number) =>
      pose({
        shoulder: abduction,
        elbow: 6,
        hip: 12,
        fold: {
          upperArmL: fold,
          upperArmR: fold,
          forearmL: fold,
          forearmR: fold,
          thighL: 0.35,
          thighR: 0.35,
        },
        anchor: on('pelvis', 0, 56),
        reach: { ankleL: pt(16, ANKLE_Y), ankleR: pt(-16, ANKLE_Y) },
        grip: 'neutre',
        contacts: ['pelvis'],
      });
    return move({
      key: 'reverse-fly-machine',
      label: 'Reverse fly à la machine',
      description:
        'Reverse fly à la machine, vu de face : assis poitrine contre l’appui, bras tendus devant, on ouvre les bras vers l’arrière en serrant les omoplates, puis on revient.',
      view: 'face',
      muscles: ['epaules', 'dos'],
      guides: { path: 'handL' },
      scene: [
        frame(pt(0, 0.8), pt(0, 44), 2),
        frame(pt(-30, 0.8), pt(30, 0.8), 1.2),
        pad(pt(-15, 46), pt(15, 46), 3),
      ],
      keys: [sit(84, 0.25), sit(88, 1)],
      ms: [1100, 1300],
    });
  },

  'hack-squat': () => {
    const feet = { ankleL: pt(18, ANKLE_Y + 4), ankleR: pt(18, ANKLE_Y + 4) };
    const sled = (x: number, y: number) =>
      pose({
        trunk: -20,
        neck: 14,
        anchor: on('pelvis', x, y),
        reach: { ...feet },
        shoulder: 140,
        elbow: 120,
        grip: 'neutre',
        contacts: ['heelL', 'pelvis'],
      });
    const start = sled(-4, 90);
    return move({
      key: 'hack-squat',
      label: 'Hack squat',
      description:
        'Hack squat : dos et épaules plaqués contre le dossier incliné, pieds sur la plateforme, on fléchit les genoux en descendant le long du rail, puis on pousse.',
      view: 'profil',
      muscles: ['quadriceps', 'fessiers'],
      guides: { path: 'pelvis' },
      scene: [
        frame(pt(-50, 0.8), pt(10, 170), 2.4),
        frame(pt(-60, 0.8), pt(40, 0.8), 1.2),
        machine.pad(pt(4, 2.2), pt(36, 2.2), 2.2),
        pad({ joint: 'pelvis', dx: -10, dy: -4 }, { joint: 'neck', dx: -10, dy: 4 }, 3.6),
        pad({ joint: 'neck', dx: -8, dy: 6 }, { joint: 'neck', dx: 6, dy: 6 }, 3),
      ],
      keys: [start, sled(-24, 50)],
      ms: [1400, 1100],
    });
  },

  'squat-smith': () => {
    const base = barOnBack({ anchor: FEET });
    const bottom = barOnBack({ trunk: 30, hip: 116, knee: 116, neck: -12, anchor: FEET });
    const bar = jointOf(base, 'handL');
    return move({
      key: 'squat-smith',
      label: 'Squat à la smith machine',
      description:
        'Squat à la smith machine : barre guidée sur le haut du dos, pieds légèrement devant, on descend en gardant le dos droit jusqu’aux cuisses horizontales, puis on remonte.',
      view: 'profil',
      muscles: ['quadriceps', 'fessiers'],
      guides: { path: 'pelvis', back: true },
      scene: [
        frame(pt(bar.x - 4, 0.8), pt(bar.x - 4, 210), 2),
        frame(pt(bar.x - 24, 210), pt(bar.x + 16, 210), 2),
        frame(pt(bar.x - 20, 0.8), pt(bar.x + 14, 0.8), 1.2),
      ],
      loads: [{ kind: 'barre', at: 'back' }],
      keys: [base, bottom],
      ms: [1300, 1100],
    });
  },
};
