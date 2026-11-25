import { describe, expect, it } from 'vitest';
import {
  MAX_TRIM_LEVEL,
  TIMING,
  applyTrimLevel,
  estimateSessionMinutes,
  fitSessionToDuration,
  minimalTrimLevel,
  trimSession,
  type MovementPattern,
  type PlannedExercise,
  type PlannedSession,
  type SessionKind,
  type SlotRole,
} from '.';

type Draft = Omit<PlannedSession, 'estimatedMinutes'>;

function item(
  slotId: string,
  role: SlotRole,
  options: {
    sets?: number;
    unilateral?: boolean;
    pattern?: MovementPattern;
    seconds?: [number, number];
  } = {},
): PlannedExercise {
  return {
    slotId,
    exerciseId: `ex-${slotId}`,
    pattern: options.pattern ?? 'genou',
    role,
    unilateral: options.unilateral ?? false,
    prescription: {
      sets: options.sets ?? 3,
      target: options.seconds
        ? { measure: 'duree', minSeconds: options.seconds[0], maxSeconds: options.seconds[1] }
        : { measure: 'repetitions', minReps: 8, maxReps: 12 },
      restSeconds: 80,
      advice: 'maintiens',
      repsInReserve: 2,
    },
  };
}

const chained = (slotId: string, seconds: number): PlannedExercise => ({
  ...item(slotId, 'accessoire', { sets: 1, seconds: [seconds, seconds] }),
  prescription: {
    ...item(slotId, 'accessoire').prescription,
    sets: 1,
    restSeconds: 0,
    target: { measure: 'duree', minSeconds: seconds, maxSeconds: seconds },
  },
});

function draft(
  kind: SessionKind,
  main: PlannedExercise[],
  warmup: PlannedExercise[] = [],
  cooldown: PlannedExercise[] = [],
): Draft {
  return {
    id: 'd0',
    dayIndex: 0,
    date: '2026-11-23',
    kind,
    title: 'Test',
    warmup,
    main,
    cooldown,
    heavyGroups: [],
  };
}

/** haut-a : trois blocs, minBlocks 1. Chaque exercice : 60 + 3 × (40 + 80) = 420 s = 7 min. */
const haut = () =>
  draft('haut-a', [
    item('b0-s0', 'principal'),
    item('b0-s1', 'principal'),
    item('b1-s0', 'secondaire'),
    item('b1-s1', 'secondaire'),
    item('b2-s0', 'accessoire', { sets: 2 }),
    item('b2-s1', 'accessoire', { sets: 2 }),
  ]);
const blocks = (session: Draft) =>
  Object.fromEntries(session.main.map((m) => [m.slotId, Number(m.slotId.slice(1, 2))]));

describe('estimateSessionMinutes', () => {
  it('compte transition, travail et repos (répétitions moyennes × 4 s)', () => {
    expect(estimateSessionMinutes(draft('haut-a', [item('b0-s0', 'principal')]))).toBe(7);
    expect(TIMING.secondsPerRep).toBe(4);
  });

  it('double le travail d’un exercice unilatéral', () => {
    // 60 + 3 × (80 + 80) = 540 s
    expect(
      estimateSessionMinutes(draft('haut-a', [item('b0-s0', 'principal', { unilateral: true })])),
    ).toBe(9);
  });

  it('prend les secondes tenues pour un exercice en durée', () => {
    // 60 + 2 × (35 + 80) = 290 s ≈ 5 min
    expect(
      estimateSessionMinutes(
        draft('haut-a', [item('b0-s0', 'principal', { sets: 2, seconds: [30, 40] })]),
      ),
    ).toBe(5);
  });

  it('ajoute échauffement et retour au calme, sans transition ni repos', () => {
    const base = draft('haut-a', [item('b0-s0', 'principal')]);
    const withWarm = {
      ...base,
      warmup: [chained('w0', 180), chained('w1', 120)],
      cooldown: [chained('c0', 120)],
    };
    expect(estimateSessionMinutes(withWarm)).toBe(7 + 7);
  });

  it('arrondit à la minute', () => {
    expect(estimateSessionMinutes(draft('haut-a', []))).toBe(0);
    expect(estimateSessionMinutes(draft('haut-a', [item('b0-s0', 'principal', { sets: 1 })]))).toBe(
      3,
    );
  });
});

describe('trimSession : étapes de raccourcissement', () => {
  const session = haut();
  const map = blocks(session);
  const slots = (level: number) =>
    trimSession(session, map, level).main.map((m) => `${m.slotId}:${m.prescription.sets}`);

  it('ne change rien au niveau 0', () => {
    expect(trimSession(session, map, 0)).toEqual(session);
  });

  it('retire d’abord les accessoires du dernier bloc qui en a', () => {
    expect(slots(1)).toEqual(['b0-s0:3', 'b0-s1:3', 'b1-s0:3', 'b1-s1:3']);
    expect(slots(2)).toEqual(slots(1));
    expect(slots(3)).toEqual(slots(1));
  });

  it('retire les accessoires bloc par bloc quand il y en a dans plusieurs', () => {
    const poussee = draft('poussee', [
      item('b0-s0', 'principal'),
      item('b1-s0', 'secondaire'),
      item('b1-s1', 'accessoire', { sets: 2 }),
      item('b2-s0', 'accessoire', { sets: 2 }),
    ]);
    const m = blocks(poussee);
    expect(trimSession(poussee, m, 1).main.map((x) => x.slotId)).toEqual([
      'b0-s0',
      'b1-s0',
      'b1-s1',
    ]);
    expect(trimSession(poussee, m, 2).main.map((x) => x.slotId)).toEqual(['b0-s0', 'b1-s0']);
  });

  it('ramène ensuite les séries à 2 sans jamais en ajouter', () => {
    const low = draft('haut-a', [
      item('b0-s0', 'principal', { sets: 1 }),
      item('b1-s0', 'secondaire', { sets: 3 }),
    ]);
    const result = trimSession(low, blocks(low), 4).main.map((m) => m.prescription.sets);
    expect(result).toEqual([1, 2]);
  });

  it('abandonne ensuite les derniers blocs, jusqu’au minimum du gabarit', () => {
    expect(slots(5)).toEqual(['b0-s0:2', 'b0-s1:2']);
    expect(slots(6)).toEqual(slots(5));
    expect(slots(MAX_TRIM_LEVEL)).toEqual(slots(5));
  });

  it('garde 2 blocs pour un corps entier (minBlocks 2)', () => {
    const full = draft('full-a', [
      item('b0-s0', 'principal'),
      item('b0-s1', 'secondaire'),
      item('b1-s0', 'principal'),
      item('b1-s1', 'principal'),
      item('b2-s0', 'accessoire'),
    ]);
    const kept = trimSession(full, blocks(full), MAX_TRIM_LEVEL).main.map((m) => m.slotId);
    expect(kept).toEqual(['b0-s0', 'b0-s1', 'b1-s0', 'b1-s1']);
  });

  it('garde le bloc équilibre des 70 ans et plus en plus du minimum du gabarit', () => {
    const senior = draft('bas-a', [
      item('b0-s0', 'secondaire', { pattern: 'equilibre', seconds: [20, 30] }),
      item('b1-s0', 'principal'),
      item('b1-s1', 'secondaire'),
      item('b2-s0', 'secondaire'),
    ]);
    const kept = trimSession(senior, blocks(senior), MAX_TRIM_LEVEL).main.map((m) => m.slotId);
    expect(kept).toEqual(['b0-s0', 'b1-s0', 'b1-s1']);
  });

  it('traite un créneau sans bloc connu comme le bloc 0 et supporte un bloc vide', () => {
    const lonely = draft('haut-a', [item('b0-s0', 'principal')]);
    expect(trimSession(lonely, {}, MAX_TRIM_LEVEL).main).toHaveLength(1);
  });
});

describe('fitSessionToDuration', () => {
  it('ne touche pas une séance qui tient déjà', () => {
    const session = haut();
    const fitted = fitSessionToDuration(session, 120, blocks(session));
    expect(fitted.main).toEqual(session.main);
    expect(fitted.estimatedMinutes).toBe(estimateSessionMinutes(session));
  });

  it('raccourcit juste ce qu’il faut pour tenir dans la cible plus 10 %', () => {
    const session = haut();
    const full = estimateSessionMinutes(session);
    for (const target of [full - 4, full - 10, 20]) {
      const fitted = fitSessionToDuration(session, target, blocks(session));
      expect(fitted.estimatedMinutes).toBeLessThanOrEqual(target * 1.1);
      const level = minimalTrimLevel(session, target, blocks(session));
      if (level > 0) {
        expect(
          estimateSessionMinutes(trimSession(session, blocks(session), level - 1)),
        ).toBeGreaterThan(target * 1.1);
      }
    }
  });

  it('garde le minimum du gabarit quand même ce plancher dépasse la cible', () => {
    const session = haut();
    const fitted = fitSessionToDuration(session, 1, blocks(session));
    expect(fitted.main.map((m) => m.slotId)).toEqual(['b0-s0', 'b0-s1']);
    expect(minimalTrimLevel(session, 1, blocks(session))).toBe(MAX_TRIM_LEVEL);
  });

  it('applique un niveau donné et recalcule la durée', () => {
    const session = haut();
    const trimmed = applyTrimLevel(session, blocks(session), 4);
    expect(trimmed.estimatedMinutes).toBe(
      estimateSessionMinutes(trimSession(session, blocks(session), 4)),
    );
    expect(trimmed.estimatedMinutes).toBeLessThan(estimateSessionMinutes(session));
  });
});
