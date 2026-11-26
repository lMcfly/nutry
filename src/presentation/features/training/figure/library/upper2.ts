/** Haut du corps (suite) : variantes de pompes, développés, écartés, tirages, triceps. */
import {
  anchorAt,
  band,
  bench,
  chair,
  inclineBench,
  mat,
  pulley,
  pullupBar,
  retag,
  table,
  wall,
} from './scene';
import { hasRig } from './rigs';
import { jointOf, move } from './build';
import { FEET, offset, onTorso, prone, seatedFloor, supine, torsoFrame } from './helpers';
import { ANKLE_Y, PALM_Y, ground, on, pose, pt } from './pose';
import { tune } from './tune';
import type { MovementFactory } from './types';
import type { Pose } from '../rig';
import type { SceneItem } from '../equipment';
import { item } from './scene';

/** Pompe sur un appui à `handY` (mur, banc) : corps gainé, pointes de pieds au sol. */
function supportedPushup(
  handY: number,
  wallX?: number,
  rise = 0,
  lower = 28,
): { keys: Pose[]; handX: number } {
  const base = (trunk: number) =>
    pose({ trunk, ankle: trunk - 82, anchor: on('toeL', 0, 0), grip: 'paume' });
  if (wallX !== undefined) {
    // Contre un mur : la main est à hauteur d'épaule, le corps s'incline vers le mur.
    const top = tune((t) => jointOf(base(t), 'shoulderL').x, wallX - 56, 5, 60);
    const down = tune((t) => jointOf(base(t), 'shoulderL').x, wallX - 26, 5, 70);
    const sh = jointOf(base(top), 'shoulderL');
    const hands = {
      handL: pt(wallX - 2.6, sh.y - 2 + rise),
      handR: pt(wallX - 2.6, sh.y - 2 + rise),
    };
    return {
      keys: [
        { ...base(top), reach: hands },
        { ...base(down), reach: hands },
      ],
      handX: wallX,
    };
  }
  const top = tune((t) => jointOf(base(t), 'shoulderL').y, handY + 57, 20, 89);
  const down = tune((t) => jointOf(base(t), 'shoulderL').y, handY + lower, 20, 89);
  const sh = jointOf(base(top), 'shoulderL');
  const hands = { handL: pt(sh.x + 6, handY + PALM_Y), handR: pt(sh.x + 6, handY + PALM_Y) };
  return {
    keys: [
      { ...base(top), reach: hands },
      { ...base(down), reach: hands },
    ],
    handX: sh.x + 6,
  };
}

/** Développé sur banc plat ou incliné (inclinaison du dossier en degrés). */
function benchPress(incline: number, dumbbells: boolean) {
  const seatTop = 45;
  const trunk = -(90 - incline);
  const pelvis = pt(0, seatTop + 10.5);
  const { front, up } = torsoFrame(trunk);
  const neck = offset(pelvis, up, 50);
  const shoulder = offset(neck, up, -5.5);
  const legs = { ankleL: pt(42, ANKLE_Y), ankleR: pt(42, ANKLE_Y) };
  const lying = { trunk, neck: incline > 0 ? 6 : 2, anchor: on('pelvis', pelvis.x, pelvis.y) };
  const top = offset(pt(shoulder.x + 4, shoulder.y), pt(0, 1), 55);
  const chest = offset(offset(shoulder, front, 14), up, -5);
  const back = pt(-front.x, -front.y);
  const pivot = offset(pelvis, back, 10.5);
  const scene: SceneItem[] =
    incline === 0
      ? bench(neck.x - 18, pelvis.x + 14, seatTop)
      : inclineBench(offset(pivot, up, -2), incline, 1, 62, 30);
  return {
    scene,
    keys: [
      pose({ ...lying, reach: { ...legs, handL: top, handR: top } }),
      pose({ ...lying, reach: { ...legs, handL: chest, handR: chest } }),
    ],
    loads: [{ kind: dumbbells ? ('halteres' as const) : ('barre' as const), at: 'hands' as const }],
  };
}

export const UPPER2: Record<string, MovementFactory> = {
  'developpe-couche': ({ incline = 0 }) => {
    const b = benchPress(incline, false);
    return move({
      key: incline > 0 ? 'developpe-incline' : 'developpe-couche',
      label: incline > 0 ? 'Développé incliné' : 'Développé couché',
      description:
        incline > 0
          ? 'Développé incliné : dos sur le banc incliné, pieds au sol, on descend la barre vers le haut de la poitrine puis on pousse vers le haut.'
          : 'Développé couché : allongé sur le banc, omoplates serrées, pieds au sol, on descend la barre jusqu’au bas de la poitrine, coudes à 45°, puis on pousse bras tendus.',
      view: 'profil',
      muscles: ['pectoraux', 'triceps', 'epaules'],
      guides: { path: 'handL' },
      grip: 'pronation',
      scene: b.scene,
      loads: b.loads,
      keys: b.keys,
      ms: [1300, 1000],
    });
  },

  'pompe-mur': () => {
    const wallX = 112;
    const { keys } = supportedPushup(0, wallX);
    return move({
      key: 'pompe-mur',
      label: 'Pompe contre un mur',
      description:
        'Pompe contre un mur : debout face au mur, mains à plat à hauteur d’épaules, corps aligné, on fléchit les coudes pour approcher la poitrine du mur, puis on repousse.',
      view: 'profil',
      muscles: ['pectoraux', 'triceps'],
      guides: { path: 'neck', back: true },
      scene: wall(wallX, 1),
      keys,
      ms: [1100, 1000],
    });
  },

  'pompe-inclinee': (variant) => {
    const onTable = hasRig(variant, 'table');
    const top = onTable ? 76 : 44;
    const { keys, handX } = supportedPushup(top);
    return move({
      key: 'pompe-inclinee',
      label: 'Pompe inclinée',
      description:
        'Pompe inclinée : mains sur un banc, corps aligné en planche inclinée, on descend la poitrine vers le bord du banc puis on pousse.',
      view: 'profil',
      muscles: ['pectoraux', 'triceps'],
      guides: { path: 'neck', back: true },
      scene: onTable ? table(handX - 16, handX + 46, top) : bench(handX - 20, handX + 40, top),
      keys,
      ms: [1100, 1000],
    });
  },

  'pompe-declinee': (variant) => {
    const feet = 42;
    const base = (trunk: number) =>
      pose({ trunk, ankle: trunk - 100, anchor: on('toeL', 0, feet), grip: 'paume' });
    const topT = tune((t) => jointOf(base(t), 'shoulderL').y, 60, 60, 130);
    const downT = tune((t) => jointOf(base(t), 'shoulderL').y, 32, 60, 130);
    const sh = jointOf(base(topT), 'shoulderL');
    const hands = { handL: pt(sh.x + 6, PALM_Y), handR: pt(sh.x + 6, PALM_Y) };
    return move({
      key: 'pompe-declinee',
      label: 'Pompe déclinée',
      description:
        'Pompe déclinée : pieds posés sur un banc, mains au sol sous les épaules, corps aligné, on fléchit les coudes puis on pousse.',
      view: 'profil',
      muscles: ['pectoraux', 'epaules', 'triceps'],
      guides: { path: 'neck', back: true },
      scene: [
        ...(hasRig(variant, 'chaise') ? chair(-36, 14, feet, -1) : bench(-40, 14, feet)),
        ...mat(sh.x - 20, sh.x + 30),
      ],
      keys: [
        { ...base(topT), reach: hands },
        { ...base(downT), reach: hands },
      ],
      ms: [1200, 1000],
    });
  },

  'pompe-claquee': () => {
    const base = (trunk: number) =>
      pose({ trunk, ankle: trunk - 78, anchor: on('toeL', 0, 0), grip: 'paume' });
    const topT = tune((t) => jointOf(base(t), 'shoulderL').y, 60, 30, 89);
    const downT = tune((t) => jointOf(base(t), 'shoulderL').y, 34, 30, 89);
    const airT = tune((t) => jointOf(base(t), 'shoulderL').y, 76, 30, 89);
    const sh = jointOf(base(topT), 'shoulderL');
    const hands = { handL: pt(sh.x + 7, PALM_Y), handR: pt(sh.x + 7, PALM_Y) };
    const airHands = { handL: pt(sh.x + 5, PALM_Y + 12), handR: pt(sh.x + 5, PALM_Y + 12) };
    return move({
      key: 'pompe-claquee',
      label: 'Pompe claquée',
      description:
        'Pompe claquée : depuis la pompe basse, on pousse de façon explosive pour que les mains quittent le sol, puis on se réceptionne bras souples.',
      view: 'profil',
      muscles: ['pectoraux', 'triceps'],
      guides: { path: 'neck', back: true },
      scene: mat(-10, 150),
      keys: [
        { ...base(topT), reach: hands },
        { ...base(downT), reach: hands },
        { ...base(airT), reach: airHands, contacts: ['toeL', 'toeR'] },
      ],
      loop: 'boucle',
      ms: [900, 380, 420],
      holds: [250, 0],
    });
  },

  'pompe-piquee': () => {
    const feet = { ankleL: pt(-42, 13), ankleR: pt(-42, 13) };
    const shape = (trunk: number, pelvisY: number) => {
      const p = pose({
        trunk,
        anchor: on('pelvis', 0, pelvisY),
        reach: feet,
        feet: 'toes',
        grip: 'paume',
      });
      return p;
    };
    const up = shape(128, 82);
    const sh = jointOf(up, 'shoulderL');
    const hands = { handL: pt(sh.x + 5, PALM_Y), handR: pt(sh.x + 5, PALM_Y) };
    return move({
      key: 'pompe-piquee',
      label: 'Pompe piquée',
      description:
        'Pompe piquée : corps en V inversé, hanches hautes, on fléchit les coudes pour descendre la tête entre les mains, puis on pousse.',
      view: 'profil',
      muscles: ['epaules', 'triceps'],
      guides: { path: 'head' },
      scene: mat(-60, 60),
      keys: [
        { ...up, reach: { ...feet, ...hands } },
        { ...shape(150, 78), reach: { ...feet, ...hands } },
      ],
      ms: [1200, 1000],
    });
  },

  'developpe-couche-sol': () => {
    const legs = { ankleL: pt(30, ANKLE_Y), ankleR: pt(30, ANKLE_Y) };
    const lying = (hands: { x: number; y: number }) =>
      supine({ reach: { ...legs, handL: hands, handR: hands }, grip: 'pronation' });
    const sh = jointOf(supine({ reach: legs }), 'shoulderL');
    return move({
      key: 'developpe-couche-sol',
      label: 'Développé au sol',
      description:
        'Développé au sol : allongé, genoux fléchis, les coudes descendent jusqu’à toucher le sol, puis on pousse les haltères vers le plafond.',
      view: 'profil',
      muscles: ['pectoraux', 'triceps'],
      guides: { path: 'handL' },
      scene: mat(-80, 50),
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [lying(pt(sh.x + 4, sh.y + 56)), lying(pt(sh.x + 10, sh.y + 22))],
      ms: [1200, 1000],
    });
  },

  'ecarte-couche': () => {
    // Vu de profil : les bras s'ouvrent sur les côtés, ils semblent donc raccourcir vers les épaules.
    const top = 44;
    const legs = { ankleL: pt(46, ANKLE_Y), ankleR: pt(46, ANKLE_Y) };
    const lying = (fold: number) =>
      pose({
        trunk: -90,
        neck: 2,
        shoulder: 92,
        elbow: 14,
        fold: { upperArmL: fold, upperArmR: fold, forearmL: fold, forearmR: fold },
        anchor: on('neck', -40, top + 10),
        reach: legs,
        grip: 'neutre',
      });
    return move({
      key: 'ecarte-couche',
      label: 'Écarté couché',
      description:
        'Écarté couché : allongé sur le banc, haltères au-dessus de la poitrine, coudes légèrement fléchis, on ouvre les bras sur les côtés en arc jusqu’à hauteur des épaules, puis on les referme.',
      view: 'profil',
      muscles: ['pectoraux'],
      guides: { path: 'handL' },
      scene: bench(-58, 16, top),
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [lying(1), lying(0.22)],
      ms: [1400, 1200],
    });
  },

  'ecarte-poulie': () => {
    const stand = (abduction: number, fold: number) =>
      pose({
        hip: 8,
        shoulder: abduction,
        elbow: 12,
        trunk: 0,
        fold: { upperArmL: fold, upperArmR: fold, forearmL: fold, forearmR: fold },
        anchor: ground(0),
        grip: 'neutre',
      });
    return move({
      key: 'ecarte-poulie',
      label: 'Écarté à la poulie',
      description:
        'Écarté à la poulie, vu de face : entre deux poulies hautes, bras ouverts et coudes souples, on ramène les mains en arc devant la poitrine, puis on rouvre lentement.',
      view: 'face',
      muscles: ['pectoraux'],
      guides: { path: 'handL' },
      scene: [
        ...pulley(70, pt(70, 172), { joint: 'handL' }),
        ...pulley(-70, pt(-70, 172), { joint: 'handR' }),
      ],
      keys: [stand(108, 1), stand(26, 0.5)],
      ms: [1200, 1300],
    });
  },

  'retraction-omoplates': () =>
    move({
      key: 'retraction-omoplates',
      label: 'Rétraction des omoplates',
      description:
        'Rétraction des omoplates : à plat ventre, bras le long du corps, on serre les omoplates en décollant légèrement les mains vers les hanches, puis on relâche.',
      view: 'profil',
      muscles: ['dos'],
      guides: { path: 'handL' },
      scene: mat(-100, 80),
      grip: 'plat',
      keys: [
        prone({ shoulder: -4 }),
        prone({
          spine: -8,
          neck: -14,
          shoulder: -24,
          elbow: 2,
          contacts: ['pelvis', 'kneeL', 'toeL'],
        }),
      ],
      ms: [900, 1100],
      holds: [300, 600],
    }),

  'rowing-inverse': () => {
    const heel = on('heelL', 78, 0);
    const body = (trunk: number) => pose({ trunk, ankle: 12, anchor: heel, grip: 'pronation' });
    const sh = jointOf(body(-62), 'shoulderL');
    const bar = pt(sh.x + 4, sh.y + 56);
    const upT = tune((t) => jointOf(body(t), 'shoulderL').y, bar.y - 22, -80, -30);
    const hands = { handL: bar, handR: bar };
    return move({
      key: 'rowing-inverse',
      label: 'Rowing inversé',
      description:
        'Rowing inversé : suspendu sous une barre basse, talons au sol, corps gainé, on tire la poitrine vers la barre en serrant les omoplates, puis on redescend.',
      view: 'profil',
      muscles: ['dos', 'biceps'],
      guides: { path: 'neck', back: true },
      scene: pullupBar(bar, bar.y + 4),
      keys: [
        { ...body(-62), reach: hands },
        { ...body(upT), reach: hands },
      ],
      ms: [1100, 1300],
    });
  },

  'rowing-penche': () => {
    const base = {
      trunk: 58,
      hip: 82,
      knee: 24,
      neck: -22,
      anchor: FEET,
      grip: 'pronation' as const,
    };
    const sh = jointOf(pose(base), 'shoulderL');
    const belly = onTorso(pose(base), 0.32, 14);
    return move({
      key: 'rowing-penche',
      label: 'Rowing barre',
      description:
        'Rowing barre : buste penché à 45° dos plat, genoux fléchis, on tire la barre vers le bas du ventre en serrant les omoplates, puis on redescend bras tendus.',
      view: 'profil',
      muscles: ['dos', 'biceps'],
      guides: { path: 'handL', back: true },
      loads: [{ kind: 'barre', at: 'hands' }],
      keys: [
        pose({
          ...base,
          reach: { handL: pt(sh.x + 2, sh.y - 56), handR: pt(sh.x + 2, sh.y - 56) },
        }),
        pose({ ...base, reach: { handL: belly, handR: belly } }),
      ],
      ms: [1000, 1300],
    });
  },

  'rowing-poitrine-appuyee': () => {
    const incline = 38;
    const trunk = 90 - incline;
    const pelvis = pt(0, 62);
    const { front, up } = torsoFrame(trunk);
    const legs = { ankleL: pt(-48, 13), ankleR: pt(-48, 13) };
    const base = {
      trunk,
      neck: -18,
      anchor: on('pelvis', pelvis.x, pelvis.y),
      feet: 'toes' as const,
      grip: 'neutre' as const,
    };
    const sh = jointOf(pose({ ...base, reach: legs }), 'shoulderL');
    const pivot = offset(offset(pelvis, front, 11), up, -4);
    return move({
      key: 'rowing-poitrine-appuyee',
      label: 'Rowing poitrine appuyée',
      description:
        'Rowing poitrine appuyée : à plat ventre sur un banc incliné, on tire les haltères en montant les coudes derrière le dos, puis on redescend bras tendus.',
      view: 'profil',
      muscles: ['dos', 'biceps'],
      guides: { path: 'handL' },
      scene: inclineBench(pivot, incline, -1, 58, 0),
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [
        pose({
          ...base,
          reach: { ...legs, handL: pt(sh.x + 2, sh.y - 54), handR: pt(sh.x + 2, sh.y - 54) },
        }),
        pose({
          ...base,
          reach: { ...legs, handL: pt(sh.x - 14, sh.y - 24), handR: pt(sh.x - 14, sh.y - 24) },
        }),
      ],
      ms: [1000, 1300],
    });
  },

  'rowing-assis': (variant) => {
    const feetAt = jointOf(seatedFloor(), 'toeL');
    const sh = jointOf(seatedFloor({ trunk: 8 }), 'shoulderL');
    return move({
      key: 'rowing-assis',
      label: 'Rowing assis',
      description:
        'Rowing assis : assis jambes tendues, dos droit, on tire les mains vers le ventre en serrant les omoplates, coudes près du corps, puis on tend les bras.',
      view: 'profil',
      muscles: ['dos', 'biceps'],
      guides: { path: 'handL', back: true },
      grip: 'neutre',
      scene: hasRig(variant, 'poulie-basse')
        ? [
            ...pulley(feetAt.x + 34, pt(feetAt.x + 10, 12), { joint: 'handL' }, 64, 'poulie'),
            item('poulie', {
              kind: 'pad',
              a: pt(feetAt.x + 3, 4),
              b: pt(feetAt.x + 3, 24),
              r: 2.4,
            }),
          ]
        : [...band({ joint: 'handL' }, feetAt), ...mat(-30, 100)],
      keys: [
        seatedFloor({
          trunk: 12,
          reach: { handL: pt(sh.x + 52, sh.y - 12), handR: pt(sh.x + 52, sh.y - 12) },
        }),
        seatedFloor({
          trunk: -4,
          reach: { handL: pt(sh.x + 8, sh.y - 26), handR: pt(sh.x + 8, sh.y - 26) },
        }),
      ],
      ms: [1000, 1300],
    });
  },

  'tirage-visage': () => {
    const stand = pose({ anchor: FEET });
    const head = jointOf(stand, 'head');
    const sh = jointOf(stand, 'shoulderL');
    const anchor = pt(sh.x + 80, sh.y + 6);
    return move({
      key: 'tirage-visage',
      label: 'Tirage visage',
      description:
        'Tirage visage : debout, élastique fixé à hauteur de tête, on tire les mains vers le visage en écartant les coudes hauts, puis on tend les bras.',
      view: 'profil',
      muscles: ['epaules', 'dos'],
      guides: { path: 'handL' },
      grip: 'pronation',
      scene: [...band({ joint: 'handL' }, anchor), ...anchorAt(anchor)],
      keys: [
        pose({
          anchor: FEET,
          reach: { handL: pt(sh.x + 52, sh.y + 4), handR: pt(sh.x + 52, sh.y + 4) },
        }),
        pose({
          anchor: FEET,
          fold: { upperArmL: 0.45, upperArmR: 0.45 },
          reach: { handL: pt(head.x + 13, head.y - 2), handR: pt(head.x + 13, head.y - 2) },
        }),
      ],
      ms: [1000, 1200],
    });
  },

  'ecarte-arriere': () => {
    const stand = (abduction: number, fold: number) =>
      pose({
        hip: 6,
        shoulder: abduction,
        elbow: 4,
        fold: { upperArmL: fold, upperArmR: fold, forearmL: fold, forearmR: fold },
        anchor: ground(0),
        grip: 'pronation',
      });
    return move({
      key: 'ecarte-arriere',
      label: 'Écarté arrière à l’élastique',
      description:
        'Écarté arrière à l’élastique, vu de face : bras tendus devant à hauteur d’épaules, on ouvre les bras sur les côtés en étirant l’élastique, puis on revient.',
      view: 'face',
      muscles: ['epaules', 'dos'],
      guides: { path: 'handL' },
      scene: band({ joint: 'handL' }, { joint: 'handR' }),
      keys: [stand(86, 0.22), stand(88, 1)],
      ms: [1000, 1200],
    });
  },

  'oiseau-penche': () => {
    // Vu de profil, à plat ventre sur un banc incliné : les bras pendants s'ouvrent sur les côtés.
    const incline = 38;
    const trunk = 90 - incline;
    const pelvis = pt(0, 62);
    const { front, up } = torsoFrame(trunk);
    const legs = { ankleL: pt(-48, 13), ankleR: pt(-48, 13) };
    const lying = (fold: number) =>
      pose({
        trunk,
        neck: -18,
        shoulder: trunk,
        elbow: 10,
        fold: { upperArmL: fold, upperArmR: fold, forearmL: fold, forearmR: fold },
        anchor: on('pelvis', pelvis.x, pelvis.y),
        reach: legs,
        feet: 'toes',
        grip: 'neutre',
      });
    const pivot = offset(offset(pelvis, front, 11), up, -4);
    return move({
      key: 'oiseau-penche',
      label: 'Oiseau buste penché',
      description:
        'Oiseau : à plat ventre sur un banc incliné, bras pendants, coudes souples, on ouvre les bras sur les côtés jusqu’à hauteur des épaules en serrant les omoplates, puis on redescend.',
      view: 'profil',
      muscles: ['epaules', 'dos'],
      guides: { path: 'handL' },
      scene: inclineBench(pivot, incline, -1, 58, 0),
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [lying(1), lying(0.24)],
      ms: [1100, 1300],
    });
  },

  'tirage-vertical': (variant) => {
    const seatTop = 46;
    const sit = (trunk: number) =>
      pose({
        trunk,
        anchor: on('pelvis', 0, seatTop + 10),
        reach: { ankleL: pt(38, ANKLE_Y), ankleR: pt(38, ANKLE_Y) },
        grip: 'pronation',
      });
    const sh = jointOf(sit(-8), 'shoulderL');
    const wheel = pt(sh.x + 6, 210);
    return move({
      key: 'tirage-vertical',
      label: 'Tirage vertical',
      description:
        'Tirage vertical : assis, cuisses calées, bras tendus vers la barre, on la tire jusqu’au haut de la poitrine en abaissant les coudes, buste légèrement incliné, puis on remonte.',
      view: 'profil',
      muscles: ['dos', 'biceps'],
      guides: { path: 'handL' },
      scene: (hasRig(variant, 'machine')
        ? (s: SceneItem[]) => retag(s, 'poulie', 'machine')
        : (s: SceneItem[]) => s)([
        ...pulley(-30, wheel, { joint: 'handL' }, 216, 'poulie'),
        item('poulie', { kind: 'pad', a: pt(-14, seatTop - 3), b: pt(22, seatTop - 3), r: 3 }),
        item('poulie', { kind: 'frame', a: pt(4, 0.8), b: pt(4, seatTop - 6), r: 1.8 }),
        item('poulie', { kind: 'pad', a: pt(14, seatTop + 22), b: pt(30, seatTop + 22), r: 3 }),
      ]),
      keys: [
        {
          ...sit(-6),
          reach: {
            ...sit(-6).reach,
            handL: pt(sh.x + 8, sh.y + 55),
            handR: pt(sh.x + 8, sh.y + 55),
          },
        },
        {
          ...sit(-14),
          reach: {
            ...sit(-14).reach,
            handL: pt(sh.x + 14, sh.y + 4),
            handR: pt(sh.x + 14, sh.y + 4),
          },
        },
      ],
      ms: [1200, 1300],
    });
  },

  'haussement-epaules': () =>
    move({
      key: 'haussement-epaules',
      label: 'Haussement d’épaules',
      description:
        'Haussement d’épaules, vu de face : debout, haltères le long du corps, on monte les épaules vers les oreilles sans plier les bras, puis on redescend.',
      view: 'face',
      muscles: ['dos', 'epaules'],
      guides: { path: 'shoulderL' },
      grip: 'neutre',
      loads: [{ kind: 'halteres', at: 'hands' }],
      keys: [
        pose({ hip: 5, shoulder: 6, elbow: 0, anchor: ground(0) }),
        pose({ hip: 5, shoulder: 6, elbow: 0, shrug: 6, anchor: ground(0) }),
      ],
      ms: [700, 1000],
      holds: [300, 500],
    }),

  'wall-angels': () =>
    move({
      key: 'wall-angels',
      label: 'Wall angels',
      description:
        'Wall angels, vu de face : dos et bras plaqués au mur, coudes à angle droit, on fait glisser les bras vers le haut en V, puis on redescend.',
      view: 'face',
      muscles: ['epaules', 'dos'],
      guides: { path: 'handL' },
      scene: [item('mur', { kind: 'box', x0: -52, x1: 52, h: 190 })],
      keys: [
        pose({ hip: 6, shoulder: 88, elbow: 92, anchor: ground(0) }),
        pose({ hip: 6, shoulder: 150, elbow: 24, anchor: ground(0) }),
      ],
      ms: [1400, 1400],
    }),

  'elevation-frontale': (variant) => {
    const toe = jointOf(pose({ anchor: FEET }), 'toeL');
    return move({
      key: 'elevation-frontale',
      label: 'Élévation frontale',
      description:
        'Élévation frontale : debout, bras tendu, on lève la main devant soi jusqu’à hauteur d’épaule, puis on redescend lentement.',
      view: 'profil',
      muscles: ['epaules'],
      guides: { path: 'handL' },
      grip: 'pronation',
      scene: hasRig(variant, 'poulie-dos')
        ? // Dos à la poulie basse : le câble part derrière le mannequin.
          pulley(-46, pt(-38, 12), { joint: 'handL' }, 110)
        : band({ joint: 'handL' }, pt(toe.x - 6, 1)),
      keys: [
        pose({ shoulderL: 4, elbowL: 2, anchor: FEET }),
        pose({ shoulderL: 90, elbowL: 2, anchor: FEET }),
      ],
      ms: [1100, 1300],
    });
  },

  'dips-chaise': () => {
    const seat = 45;
    const hands = { handL: pt(2, seat + PALM_Y), handR: pt(2, seat + PALM_Y) };
    const legs = { ankleL: pt(64, ANKLE_Y), ankleR: pt(64, ANKLE_Y) };
    return move({
      key: 'dips-chaise',
      label: 'Dips sur chaise',
      description:
        'Dips sur chaise : mains au bord de l’assise derrière soi, doigts vers l’avant, on fléchit les coudes vers l’arrière pour descendre le bassin, puis on pousse bras tendus.',
      view: 'profil',
      muscles: ['triceps', 'pectoraux'],
      guides: { path: 'pelvis', back: true },
      grip: 'paume',
      scene: chair(-38, 4, seat, -1),
      keys: [
        pose({ trunk: 4, anchor: on('pelvis', 9, 62), reach: { ...hands, ...legs } }),
        pose({ trunk: 8, anchor: on('pelvis', 10, 32), reach: { ...hands, ...legs } }),
      ],
      ms: [1200, 1000],
    });
  },

  'dips-sol': () => {
    const hands = { handL: pt(-22, PALM_Y), handR: pt(-22, PALM_Y) };
    const legs = { ankleL: pt(48, ANKLE_Y), ankleR: pt(48, ANKLE_Y) };
    return move({
      key: 'dips-sol',
      label: 'Dips au sol',
      description:
        'Dips au sol : assis, mains au sol derrière les fesses, bassin décollé, on fléchit les coudes vers l’arrière, puis on pousse.',
      view: 'profil',
      muscles: ['triceps'],
      guides: { path: 'neck' },
      grip: 'paume',
      scene: mat(-40, 70),
      keys: [
        pose({ trunk: -16, anchor: on('pelvis', 2, 22), reach: { ...hands, ...legs } }),
        pose({ trunk: -28, anchor: on('pelvis', -2, 14), reach: { ...hands, ...legs } }),
      ],
      ms: [1100, 1000],
    });
  },

  'extension-triceps-tete': () =>
    move({
      key: 'extension-triceps-tete',
      label: 'Extension triceps au-dessus de la tête',
      description:
        'Extension triceps au-dessus de la tête : coudes pointés vers le plafond, on descend l’haltère derrière la tête en fléchissant les coudes, puis on tend les bras.',
      view: 'profil',
      muscles: ['triceps'],
      guides: { path: 'handL' },
      grip: 'neutre',
      loads: [{ kind: 'halteres', at: 'handL' }],
      keys: [
        pose({ shoulder: 172, elbow: 136, anchor: FEET }),
        pose({ shoulder: 174, elbow: 6, anchor: FEET }),
      ],
      ms: [1200, 1100],
    }),

  'kickback-triceps': () => {
    const base = { trunk: 64, hipL: 54, kneeL: 14, hipR: 98, kneeR: 46, neck: -22, anchor: FEET };
    const knee = jointOf(pose(base), 'kneeR');
    const support = pt(knee.x - 6, knee.y + 9);
    return move({
      key: 'kickback-triceps',
      label: 'Kickback triceps',
      description:
        'Kickback triceps : buste penché, coude collé au corps et fixe, on tend l’avant-bras vers l’arrière, puis on revient à angle droit.',
      view: 'profil',
      muscles: ['triceps'],
      guides: { path: 'handL', back: true },
      grip: { L: 'neutre', R: 'plat' },
      loads: [{ kind: 'halteres', at: 'handL' }],
      keys: [
        pose({ ...base, shoulderL: -24, elbowL: 92, reach: { handR: support } }),
        pose({ ...base, shoulderL: -24, elbowL: 4, reach: { handR: support } }),
      ],
      ms: [900, 1200],
    });
  },

  'extension-triceps-bas': (variant) => {
    const stand = pose({ trunk: 8, anchor: FEET });
    const sh = jointOf(stand, 'shoulderL');
    const wheel = pt(sh.x + 26, 200);
    return move({
      key: 'extension-triceps-bas',
      label: 'Extension triceps à la poulie',
      description:
        'Extension triceps à la poulie haute : coudes collés au corps, on pousse la poignée vers le bas jusqu’à bras tendus, puis on remonte jusqu’à angle droit.',
      view: 'profil',
      muscles: ['triceps'],
      guides: { path: 'handL' },
      grip: 'pronation',
      scene: hasRig(variant, 'elastique-ancre-haut')
        ? [...band({ joint: 'handL' }, wheel), ...anchorAt(wheel)]
        : pulley(sh.x + 26, wheel, { joint: 'handL' }, 206),
      keys: [
        pose({ trunk: 8, shoulder: 10, elbow: 100, anchor: FEET }),
        pose({ trunk: 8, shoulder: 10, elbow: 6, anchor: FEET }),
      ],
      ms: [900, 1200],
    });
  },

  'barre-au-front': () => {
    const top = 44;
    const lying = { trunk: -90, neck: 2, anchor: on('neck', -40, top + 10) };
    const legs = { ankleL: pt(46, ANKLE_Y), ankleR: pt(46, ANKLE_Y) };
    const head = jointOf(pose({ ...lying, reach: legs }), 'head');
    return move({
      key: 'barre-au-front',
      label: 'Barre au front',
      description:
        'Barre au front : allongé sur le banc, bras tendus au-dessus des épaules, on fléchit seulement les coudes pour descendre la barre vers le front, puis on tend les bras.',
      view: 'profil',
      muscles: ['triceps'],
      guides: { path: 'handL' },
      grip: 'pronation',
      scene: bench(-58, 16, top),
      loads: [{ kind: 'barre-ez', at: 'hands' }],
      keys: [
        pose({ ...lying, shoulder: 84, elbow: 4, reach: legs }),
        pose({
          ...lying,
          reach: {
            ...legs,
            handL: pt(head.x + 2, head.y + 14),
            handR: pt(head.x + 2, head.y + 14),
          },
        }),
      ],
      ms: [1200, 1100],
    });
  },
};
