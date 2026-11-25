import { describe, expect, it } from 'vitest';
import { makeProfile } from '../testing/fixtures';
import { makePlanInput, makeTraining } from '../testing/training.fixtures';
import {
  finishSessionLog,
  isSessionComplete,
  logSet,
  markExerciseDone,
  planTrainingWeek,
  replaceExerciseInLog,
  sessionCompletion,
  sessionLogId,
  startSessionLog,
  trainingConstraintsKey,
  trainingDaysOf,
  type PlannedExercise,
  type PlannedSession,
  type SessionLog,
  type SlotRole,
} from '.';

function item(slotId: string, role: SlotRole, sets: number): PlannedExercise {
  return {
    slotId,
    exerciseId: `ex-${slotId}`,
    pattern: 'genou',
    role,
    unilateral: false,
    prescription: {
      sets,
      target: { measure: 'repetitions', minReps: 8, maxReps: 12 },
      restSeconds: 60,
      advice: 'maintiens',
      repsInReserve: 2,
    },
  };
}

const SESSION: PlannedSession = {
  id: 'd0',
  dayIndex: 0,
  date: '2026-11-23',
  kind: 'full-a',
  title: 'Corps entier A',
  warmup: [],
  main: [
    item('b0-s0', 'principal', 3),
    item('b0-s1', 'principal', 2),
    item('b1-s0', 'secondaire', 3),
    item('b2-s0', 'accessoire', 2),
  ],
  cooldown: [],
  estimatedMinutes: 40,
  heavyGroups: [],
};
const WEEK = '2026-11-23';
const open = (): SessionLog => startSessionLog(SESSION, WEEK, '2026-11-23', '2026-11-23T18:00:00');

describe('journal de séance', () => {
  it('ouvre un journal avec toutes les séries prévues, non faites', () => {
    const log = open();
    expect(log.id).toBe(sessionLogId(WEEK, 'd0'));
    expect(log.id).toBe('2026-11-23:d0');
    expect(log.status).toBe('en-cours');
    expect(log.exercises.map((e) => [e.slotId, e.sets.length, e.done])).toEqual([
      ['b0-s0', 3, false],
      ['b0-s1', 2, false],
      ['b1-s0', 3, false],
      ['b2-s0', 2, false],
    ]);
    expect(log.exercises[0]?.sets[2]).toEqual({ index: 2, done: false });
  });

  it('enregistre une série sans modifier le journal d’origine', () => {
    const log = open();
    const next = logSet(log, 'b0-s0', { index: 1, done: true, reps: 10, loadKg: 12 });
    expect(next.exercises[0]?.sets[1]).toEqual({ index: 1, done: true, reps: 10, loadKg: 12 });
    expect(log.exercises[0]?.sets[1]).toEqual({ index: 1, done: false });
    expect(next.exercises[1]).toBe(log.exercises[1]);
  });

  it('ajoute une série supplémentaire à la suite, et ignore un exercice inconnu', () => {
    const extra = logSet(open(), 'b0-s0', { index: 3, done: true, reps: 8 });
    expect(extra.exercises[0]?.sets.map((s) => s.index)).toEqual([0, 1, 2, 3]);
    expect(logSet(open(), 'inconnu', { index: 0, done: true })).toEqual(open());
  });

  it('décocher une série annule le « fait » de l’exercice', () => {
    const done = markExerciseDone(open(), 'b0-s0');
    expect(done.exercises[0]?.done).toBe(true);
    expect(done.exercises[0]?.sets.every((s) => s.done)).toBe(true);
    const undone = logSet(done, 'b0-s0', { index: 0, done: false });
    expect(undone.exercises[0]?.done).toBe(false);
    const stillDone = logSet(done, 'b0-s0', { index: 0, done: true, reps: 9 });
    expect(stillDone.exercises[0]?.done).toBe(true);
  });

  it('garde trace de l’exercice prévu quand on le remplace, et remet les séries à zéro', () => {
    const progress = logSet(open(), 'b0-s0', { index: 0, done: true, reps: 10 });
    const replaced = replaceExerciseInLog(progress, 'b0-s0', 'autre');
    expect(replaced.exercises[0]).toMatchObject({
      exerciseId: 'autre',
      replacedExerciseId: 'ex-b0-s0',
      done: false,
    });
    expect(replaced.exercises[0]?.sets.every((s) => !s.done && s.reps === undefined)).toBe(true);
    const twice = replaceExerciseInLog(replaced, 'b0-s0', 'encore');
    expect(twice.exercises[0]).toMatchObject({
      exerciseId: 'encore',
      replacedExerciseId: 'ex-b0-s0',
    });
  });

  it('termine la séance avec ou sans ressenti', () => {
    const done = finishSessionLog(open(), '2026-11-23T18:40:00', 'correct');
    expect(done).toMatchObject({
      status: 'terminee',
      completedAt: '2026-11-23T18:40:00',
      effort: 'correct',
    });
    expect('effort' in finishSessionLog(open(), '2026-11-23T18:40:00')).toBe(false);
  });
});

describe('isSessionComplete', () => {
  it('est faux au départ et quand on a seulement coché une série', () => {
    expect(isSessionComplete(SESSION, open())).toBe(false);
    expect(isSessionComplete(SESSION, logSet(open(), 'b0-s0', { index: 0, done: true }))).toBe(
      false,
    );
  });

  it('est vrai quand chaque exercice principal est fait (validé ou toutes séries cochées)', () => {
    let log = markExerciseDone(open(), 'b0-s0');
    expect(isSessionComplete(SESSION, log)).toBe(false);
    log = logSet(logSet(log, 'b0-s1', { index: 0, done: true }), 'b0-s1', { index: 1, done: true });
    expect(isSessionComplete(SESSION, log)).toBe(true);
    expect(log.status).toBe('en-cours');
  });

  it('ne demande ni le secondaire ni l’accessoire', () => {
    const log = markExerciseDone(markExerciseDone(open(), 'b0-s0'), 'b0-s1');
    expect(isSessionComplete(SESSION, log)).toBe(true);
  });

  it('est vrai quand la personne termine avec au moins une série faite', () => {
    const one = finishSessionLog(
      logSet(open(), 'b1-s0', { index: 0, done: true }),
      '2026-11-23T18:30:00',
    );
    expect(isSessionComplete(SESSION, one)).toBe(true);
    expect(isSessionComplete(SESSION, finishSessionLog(open(), '2026-11-23T18:30:00'))).toBe(false);
    expect(
      isSessionComplete(SESSION, finishSessionLog(markExerciseDone(open(), 'b2-s0'), 'x')),
    ).toBe(true);
  });

  it('retombe sur tous les exercices quand il n’y a pas de principal, et refuse une séance vide', () => {
    const noPrincipal: PlannedSession = {
      ...SESSION,
      main: [item('b0-s0', 'secondaire', 2), item('b1-s0', 'accessoire', 2)],
    };
    const log = startSessionLog(noPrincipal, WEEK, WEEK, '2026-11-23T18:00:00');
    expect(isSessionComplete(noPrincipal, markExerciseDone(log, 'b0-s0'))).toBe(false);
    expect(
      isSessionComplete(noPrincipal, markExerciseDone(markExerciseDone(log, 'b0-s0'), 'b1-s0')),
    ).toBe(true);
    const empty: PlannedSession = { ...SESSION, main: [] };
    expect(isSessionComplete(empty, startSessionLog(empty, WEEK, WEEK, 'x'))).toBe(false);
  });

  it('exige que la ligne de journal existe et qu’un exercice sans série ne compte pas comme fait', () => {
    const missing: SessionLog = { ...open(), exercises: [] };
    expect(isSessionComplete(SESSION, missing)).toBe(false);
    const noSets: SessionLog = {
      ...open(),
      exercises: open().exercises.map((e) => ({ ...e, sets: [] })),
    };
    expect(isSessionComplete(SESSION, noSets)).toBe(false);
  });
});

describe('sessionCompletion', () => {
  it('compte les séries faites sur les séries prévues', () => {
    expect(sessionCompletion(SESSION, open())).toEqual({ doneSets: 0, plannedSets: 10, ratio: 0 });
    const log = logSet(logSet(open(), 'b0-s0', { index: 0, done: true }), 'b0-s0', {
      index: 1,
      done: true,
    });
    expect(sessionCompletion(SESSION, log)).toEqual({ doneSets: 2, plannedSets: 10, ratio: 0.2 });
  });

  it('compte toutes les séries d’un exercice validé et plafonne aux séries prévues', () => {
    const log = markExerciseDone(open(), 'b0-s0');
    expect(sessionCompletion(SESSION, log).doneSets).toBe(3);
    const extra = logSet(open(), 'b0-s1', { index: 2, done: true });
    const more = logSet(logSet(extra, 'b0-s1', { index: 0, done: true }), 'b0-s1', {
      index: 1,
      done: true,
    });
    expect(sessionCompletion(SESSION, more).doneSets).toBe(2);
  });

  it('vaut 1 pour une séance entièrement faite, 0 sans séries prévues ni ligne de journal', () => {
    let log = open();
    for (const m of SESSION.main) log = markExerciseDone(log, m.slotId);
    expect(sessionCompletion(SESSION, log).ratio).toBe(1);
    const empty: PlannedSession = { ...SESSION, main: [] };
    expect(sessionCompletion(empty, open())).toEqual({ doneSets: 0, plannedSets: 0, ratio: 0 });
    expect(sessionCompletion(SESSION, { ...open(), exercises: [] }).doneSets).toBe(0);
  });
});

describe('trainingDaysOf', () => {
  it('donne les jours de séance, hors séances douces, triés', () => {
    const plan = planTrainingWeek(
      makePlanInput({ frequency: 5, days: [0, 1, 2, 4, 5], level: 'debutant' }),
    );
    const strength = plan.sessions.filter((s) => s.kind !== 'douce').map((s) => s.dayIndex);
    expect(strength.length).toBeLessThan(5);
    expect(trainingDaysOf(plan)).toEqual({ weekStart: plan.weekStart, trainingDays: strength });
  });

  it('ne garde aucun jour quand tout est doux', () => {
    const plan = planTrainingWeek(
      makePlanInput({ frequency: 1, days: [5] }, { healthCondition: true }, {}),
    );
    expect(trainingDaysOf(plan).trainingDays).toEqual([5]);
    const soft = {
      ...plan,
      sessions: plan.sessions.map((s) => ({ ...s, kind: 'douce' as const })),
    };
    expect(trainingDaysOf(soft).trainingDays).toEqual([]);
  });
});

describe('trainingConstraintsKey', () => {
  const key = (training = {}, profile = {}) =>
    trainingConstraintsKey(makeProfile(profile), makeTraining(training));

  it('est stable pour la même entrée et indifférente à l’ordre des jours et du matériel', () => {
    expect(key()).toBe(key());
    expect(key({ days: [4, 0, 2] })).toBe(key({ days: [0, 2, 4] }));
    expect(key({ equipment: ['elastique', 'tapis', 'halteres'] })).toBe(
      key({ equipment: ['halteres', 'tapis', 'elastique'] }),
    );
  });

  it.each([
    ['les jours', { days: [0, 1, 3] }, {}],
    ['le cadre', { setting: 'salle' }, {}],
    ['le matériel', { equipment: ['tapis'] }, {}],
    ['le niveau', { level: 'confirme' }, {}],
    ['l’objectif', { goal: 'force' }, {}],
    ['la durée', { sessionMinutes: 30 }, {}],
    ['la grossesse', {}, { pregnantOrBreastfeeding: true }],
    ['la condition de santé', {}, { healthCondition: true }],
    ['le seuil de 70 ans', {}, { age: 70 }],
    ['le seuil de 18 ans', {}, { age: 17 }],
  ] as const)('change avec %s', (_label, training, profile) => {
    expect(key(training, profile)).not.toBe(key());
  });

  it('change avec l’étape de grossesse seulement s’il y a grossesse', () => {
    const pregnant = { pregnantOrBreastfeeding: true };
    expect(key({ pregnancyStage: 'post-partum' }, pregnant)).not.toBe(
      key({ pregnancyStage: 'premier-trimestre' }, pregnant),
    );
    expect(key({}, pregnant)).not.toBe(
      key({ pregnancyStage: 'apres-premier-trimestre' }, pregnant),
    );
    expect(key({ pregnancyStage: 'post-partum' })).toBe(key());
    expect(
      key({ pregnancyStage: 'post-partum' }, { sex: 'homme', pregnantOrBreastfeeding: true }),
    ).toBe(key());
  });

  it('ne change pas à un anniversaire ordinaire ni avec le poids', () => {
    expect(key({}, { age: 41 })).toBe(key({}, { age: 42 }));
    expect(key({}, { age: 69 })).toBe(key({}, { age: 30 }));
    expect(key({}, { weightKg: 90 })).toBe(key());
  });
});
