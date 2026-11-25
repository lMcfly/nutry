import { describe, expect, it } from 'vitest';
import { EXERCISE_FIXTURES, fixtureExercise } from '../testing/exercises.fixtures';
import { TODAY, WEEK, makePlanInput } from '../testing/training.fixtures';
import { addDays } from '../shared';
import {
  DEFAULT_TRAINING_DAYS,
  TIMING,
  TRAINING_NOTICES,
  assessTrainingSafety,
  findAlternatives,
  isExerciseEligible,
  isLoadedExercise,
  planTrainingWeek,
  startSessionLog,
  EQUIPMENT_BY_SETTING,
  type ExerciseLog,
  type PainReport,
  type PlanTrainingWeekInput,
  type PlannedSession,
  type SessionLog,
  type TrainingFrequency,
  type WeeklyTrainingPlan,
} from '.';

const plan = (input: PlanTrainingWeekInput) => planTrainingWeek(input);
const mainOf = (p: WeeklyTrainingPlan) =>
  p.sessions.flatMap((s) =>
    s.main.map((m) => ({ key: `${s.id}/${m.slotId}`, role: m.role, id: m.exerciseId })),
  );
const doneWeek = (n: number): SessionLog => {
  const weekStart = addDays(WEEK, -7 * n);
  return {
    id: `${weekStart}:d0`,
    weekStart,
    sessionId: 'd0',
    date: weekStart,
    status: 'terminee',
    startedAt: `${weekStart}T18:00:00`,
    completedAt: `${weekStart}T18:40:00`,
    exercises: [],
  };
};
const weekAt = (activeWeeks: number, base: Partial<Parameters<typeof makePlanInput>[0]> = {}) =>
  plan(
    makePlanInput(
      { setting: 'salle', level: 'intermediaire', ...base },
      {},
      { logs: Array.from({ length: activeWeeks }, (_, i) => doneWeek(activeWeeks - i)) },
    ),
  );

describe('split et jours', () => {
  it.each([
    [1, 'full-body'],
    [2, 'full-body'],
    [3, 'full-body'],
    [4, 'haut-bas'],
    [5, 'ppl-haut-bas'],
    [6, 'ppl'],
  ] as const)(
    '%i jour(s) par défaut : %s, une séance par jour',
    (frequency: TrainingFrequency, split) => {
      const p = plan(makePlanInput({ frequency, days: DEFAULT_TRAINING_DAYS[frequency] }));
      expect(p.split).toBe(split);
      expect(p.sessions.map((s) => s.dayIndex)).toEqual(DEFAULT_TRAINING_DAYS[frequency]);
      expect(p.sessions.every((s) => s.kind !== 'douce')).toBe(true);
      expect(p.sessions.map((s) => s.date)).toEqual(
        DEFAULT_TRAINING_DAYS[frequency].map((d) => addDays(WEEK, d)),
      );
      expect(p.notices).toEqual([]);
    },
  );

  it('ramène une date en milieu de semaine au lundi', () => {
    expect(plan(makePlanInput({}, {}, { weekStart: '2026-11-25' })).weekStart).toBe(WEEK);
  });

  it('plafonne à 3 séances de renforcement avec une condition de santé (décision validée)', () => {
    const p = plan(
      makePlanInput(
        { level: 'confirme', frequency: 6, days: [0, 1, 2, 3, 4, 5] },
        { healthCondition: true },
      ),
    );
    expect(p.sessions.filter((s) => s.kind !== 'douce')).toHaveLength(3);
    expect(p.sessions.filter((s) => s.kind === 'douce')).toHaveLength(3);
    expect(p.notices.map((n) => n.code)).toContain('seances-plafonnees');
  });

  it('plafonne un débutant à 4 séances et signale les jours trop proches', () => {
    const beginner = plan(
      makePlanInput({ level: 'debutant', frequency: 5, days: [0, 1, 2, 4, 5] }),
    );
    expect(beginner.sessions.filter((s) => s.kind !== 'douce').length).toBeLessThanOrEqual(4);
    expect(beginner.notices.map((n) => n.code)).toContain('seances-plafonnees');
    const close = plan(makePlanInput({ frequency: 3, days: [0, 1, 2] }));
    expect(close.notices.map((n) => n.code)).toContain('jours-rapproches');
    expect(close.sessions.map((s) => s.kind)).toContain('douce');
  });

  it('donne un texte à chaque avis, au tutoiement et sans calories', () => {
    const p = plan(makePlanInput({ level: 'debutant', frequency: 5, days: [0, 1, 2, 4, 5] }));
    for (const n of p.notices) {
      expect(n.message).toBe(TRAINING_NOTICES[n.code]);
      expect(n.message).not.toMatch(/calorie|kcal|brûl|maigr/i);
    }
    expect(Object.keys(TRAINING_NOTICES)).toHaveLength(5);
  });
});

describe('rotation', () => {
  it('garde principal et secondaire pendant tout un bloc, et les change au bloc suivant', () => {
    const fixed = (p: WeeklyTrainingPlan) => mainOf(p).filter((m) => m.role !== 'accessoire');
    const weeks = [0, 1, 2, 3].map((n) => fixed(weekAt(n)));
    for (const w of weeks) expect(w).toEqual(weeks[0]);
    const nextBlock = fixed(weekAt(5));
    expect(nextBlock).not.toEqual(weeks[0]);
    expect(nextBlock.map((m) => m.key)).toEqual((weeks[0] ?? []).map((m) => m.key));
  });

  it('fait tourner les accessoires chaque semaine', () => {
    const acc = (n: number) =>
      mainOf(weekAt(n))
        .filter((m) => m.role === 'accessoire')
        .map((m) => m.id);
    expect(acc(0)).not.toEqual(acc(1));
    expect(acc(1)).not.toEqual(acc(2));
    expect(acc(0).length).toBeGreaterThan(0);
  });

  it('change d’exercice quand il est utilisé ailleurs dans la semaine (variété)', () => {
    const p = weekAt(0, { frequency: 3, days: [0, 2, 4] });
    const knees = p.sessions.flatMap((s) =>
      s.main.filter((m) => m.pattern === 'genou').map((m) => m.exerciseId),
    );
    expect(new Set(knees).size).toBeGreaterThan(1);
  });
});

describe('semaine allégée et reprise', () => {
  it('allège la 5e semaine d’un bloc intermédiaire : moitié des séries, avis dédié', () => {
    const normal = weekAt(3);
    const light = weekAt(4);
    expect(light.cycle).toMatchObject({ deload: true, deloadReason: 'cycle', weekInBlock: 5 });
    expect(light.notices.map((n) => n.code)).toEqual(['semaine-allegee']);
    const sets = (p: WeeklyTrainingPlan) =>
      p.sessions.flatMap((s) => s.main.map((m) => m.prescription.sets));
    expect(Math.max(...sets(light))).toBeLessThan(Math.max(...sets(normal)));
    for (const item of light.sessions.flatMap((s) => s.main)) {
      expect(item.prescription.advice).toBe('semaine-allegee');
    }
    expect(weekAt(5).cycle.deload).toBe(false);
  });

  it('allège la semaine de reprise après deux semaines sans séance', () => {
    const p = plan(makePlanInput({}, {}, { logs: [doneWeek(3)] }));
    expect(p.cycle).toMatchObject({ deload: true, deloadReason: 'reprise' });
    expect(p.notices.map((n) => n.code)).toEqual(['reprise']);
    expect(p.notices[0]?.message).toBe(TRAINING_NOTICES.reprise);
  });
});

describe('progression à partir des journaux', () => {
  it('monte la charge quand toutes les séries de la semaine précédente étaient à la borne haute', () => {
    const base = makePlanInput({ setting: 'maison-equipee', frequency: 3, days: [0, 2, 4] });
    const first = plan({ ...base, weekStart: addDays(WEEK, -7), today: addDays(TODAY, -7) });
    const session = first.sessions[0] as PlannedSession;
    const loaded = session.main.find((m) => isLoadedExercise(fixtureExercise(m.exerciseId)));
    expect(loaded).toBeDefined();
    const exercise: ExerciseLog = {
      slotId: loaded?.slotId ?? '',
      exerciseId: loaded?.exerciseId ?? '',
      done: true,
      sets: Array.from({ length: loaded?.prescription.sets ?? 0 }, (_, index) => ({
        index,
        done: true,
        reps:
          loaded?.prescription.target.measure === 'repetitions'
            ? loaded.prescription.target.maxReps
            : 0,
        loadKg: 10,
      })),
    };
    const log: SessionLog = {
      ...startSessionLog(session, first.weekStart, first.weekStart, '2026-11-16T18:00:00'),
      status: 'terminee',
      exercises: [exercise],
    };
    const next = plan({ ...base, logs: [log] });
    const again = next.sessions
      .flatMap((s) => s.main)
      .find((m) => m.exerciseId === loaded?.exerciseId);
    expect(again?.prescription.advice).toBe('augmente-la-charge');
    expect(again?.prescription.loadKg).toBeGreaterThan(10);
    // La semaine des journaux ne dépend pas d'eux : un journal de la même semaine est ignoré.
    const sameWeek = plan({ ...base, logs: [{ ...log, weekStart: WEEK, id: `${WEEK}:d0` }] });
    expect(
      sameWeek.sessions
        .flatMap((s) => s.main)
        .every((m) => m.prescription.advice !== 'augmente-la-charge'),
    ).toBe(true);
  });
});

describe('douleur et remplacement', () => {
  const base = makePlanInput({ setting: 'salle', frequency: 3, days: [0, 2, 4] });
  const baseline = plan(base);
  const target = baseline.sessions[0]?.main[0]?.exerciseId as string;
  const report = (daysAgo: number): PainReport => {
    const date = addDays(TODAY, -daysAgo);
    return {
      id: `${date}:${target}`,
      date,
      exerciseId: target,
      muscles: fixtureExercise(target).primaryMuscles.slice(),
    };
  };
  const used = (p: WeeklyTrainingPlan) =>
    p.sessions.flatMap((s) => s.main.map((m) => m.exerciseId));

  it('écarte l’exercice signalé de tout le programme pendant 28 jours', () => {
    expect(used(baseline)).toContain(target);
    for (const daysAgo of [0, 1, 27]) {
      const p = plan({ ...base, painReports: [report(daysAgo)] });
      expect(used(p), `il y a ${daysAgo} j`).not.toContain(target);
      expect(p.sessions.map((s) => s.main.length)).toEqual(
        baseline.sessions.map((s) => s.main.length),
      );
    }
  });

  it('le propose de nouveau le 28e jour', () => {
    expect(plan({ ...base, painReports: [report(28)] })).toEqual(baseline);
  });

  it('remplace par un exercice du même schéma, éligible, qui ne porte pas les étiquettes de l’exercice douloureux', () => {
    const exercise = fixtureExercise(target);
    const context = {
      pattern: exercise.pattern,
      role: 'principal' as const,
      level: base.training.level,
      equipment: EQUIPMENT_BY_SETTING.salle,
      safety: assessTrainingSafety(base.profile, base.training),
      avoidedExerciseIds: [target],
    };
    const alternatives = findAlternatives({
      exercise,
      reason: 'douleur',
      catalog: EXERCISE_FIXTURES,
      context,
    });
    expect(alternatives.length).toBeGreaterThan(0);
    for (const alt of alternatives) {
      expect(alt.id).not.toBe(target);
      expect(alt.pattern).toBe(exercise.pattern);
      expect(isExerciseEligible(alt, context)).toBe(true);
      expect(alt.tags.filter((t) => exercise.tags.includes(t))).toEqual([]);
    }
  });

  it('un profil protégé garde ses exclusions même après une douleur', () => {
    const p = plan({
      ...makePlanInput({ setting: 'maison' }, { pregnantOrBreastfeeding: true }),
      painReports: [report(1)],
    });
    for (const id of p.sessions.flatMap((s) =>
      [...s.warmup, ...s.main, ...s.cooldown].map((m) => m.exerciseId),
    )) {
      expect(fixtureExercise(id).tags).not.toContain('allonge-dos');
    }
  });
});

describe('catalogue insuffisant', () => {
  it('retire les créneaux sans candidat et le signale, sans planter', () => {
    const empty = plan(makePlanInput({}, {}, { catalog: [] }));
    expect(empty.sessions.every((s) => s.main.length === 0 && s.estimatedMinutes === 0)).toBe(true);
    expect(empty.notices.map((n) => n.code)).toContain('catalogue-insuffisant');
    const partial = plan(
      makePlanInput(
        { setting: 'maison' },
        {},
        { catalog: EXERCISE_FIXTURES.filter((e) => e.pattern !== 'genou') },
      ),
    );
    expect(partial.notices.map((n) => n.code)).toContain('catalogue-insuffisant');
    expect(partial.sessions.flatMap((s) => s.main).some((m) => m.pattern === 'genou')).toBe(false);
    expect(partial.sessions.flatMap((s) => s.main).length).toBeGreaterThan(0);
  });
});

describe('profils protégés', () => {
  it('ajoute un bloc équilibre et mobilité à chaque séance de renforcement des 70 ans et plus', () => {
    const p = plan(
      makePlanInput({ frequency: 3, days: [0, 2, 4], level: 'debutant' }, { age: 72 }),
    );
    for (const s of p.sessions) {
      expect(s.main.some((m) => m.pattern === 'equilibre')).toBe(true);
      expect(s.main[0]?.slotId).toBe('b0-s0');
    }
    const young = plan(makePlanInput({ frequency: 3, days: [0, 2, 4] }, { age: 69 }));
    expect(young.sessions.flatMap((s) => s.main).some((m) => m.pattern === 'equilibre')).toBe(
      false,
    );
  });

  it('suit le niveau d’intensité modéré : 3 répétitions en réserve et aucune charge', () => {
    const p = plan(makePlanInput({ setting: 'salle' }, { pregnantOrBreastfeeding: true }));
    for (const m of p.sessions.flatMap((s) => s.main)) {
      expect(m.prescription.repsInReserve).toBe(3);
      expect(m.prescription.loadKg).toBeUndefined();
    }
  });

  it('autorise l’allongé sur le dos au 1er trimestre mais pas ensuite, et l’impact jamais', () => {
    const catalog = EXERCISE_FIXTURES.filter((e) => e.id !== 'bonjour-poids-du-corps');
    const hipOnly = (stage?: 'premier-trimestre' | 'apres-premier-trimestre') =>
      plan(
        makePlanInput(
          {
            setting: 'maison',
            level: 'debutant',
            frequency: 2,
            days: [0, 3],
            ...(stage ? { pregnancyStage: stage } : {}),
          },
          { pregnantOrBreastfeeding: true },
          {
            catalog: catalog.filter(
              (e) =>
                e.pattern !== 'hanche' ||
                e.id === 'pont-fessier' ||
                e.id === 'quadrupedie-extension-hanche',
            ),
          },
        ),
      );
    const ids = (p: WeeklyTrainingPlan) =>
      p.sessions.flatMap((s) => s.main.map((m) => m.exerciseId));
    expect(ids(hipOnly('premier-trimestre'))).toContain('pont-fessier');
    expect(ids(hipOnly('apres-premier-trimestre'))).not.toContain('pont-fessier');
    expect(ids(hipOnly())).not.toContain('pont-fessier');
  });
});

describe('machines de salle', () => {
  const equipmentOf = (p: WeeklyTrainingPlan) =>
    p.sessions.flatMap((s) => s.main.map((m) => fixtureExercise(m.exerciseId).equipment));

  it('met une machine guidée en tête des créneaux principaux d’un débutant en salle', () => {
    const p = plan(
      makePlanInput({ setting: 'salle', level: 'debutant', frequency: 3, days: [0, 2, 4] }),
    );
    const principals = p.sessions.flatMap((s) => s.main.filter((m) => m.role === 'principal'));
    expect(
      principals.some((m) => fixtureExercise(m.exerciseId).equipment.includes('machine')),
    ).toBe(true);
  });

  it('n’en propose jamais à la maison ni en salle sans machine', () => {
    for (const setting of ['maison', 'maison-equipee'] as const) {
      expect(equipmentOf(plan(makePlanInput({ setting }))).flat()).not.toContain('machine');
    }
    const noMachine = plan(
      makePlanInput({
        setting: 'salle',
        equipment: EQUIPMENT_BY_SETTING.salle.filter((e) => e !== 'machine'),
      }),
    );
    expect(equipmentOf(noMachine).flat()).not.toContain('machine');
  });

  it('garde des charges libres pour un confirmé en salle', () => {
    const p = plan(makePlanInput({ setting: 'salle', level: 'confirme' }));
    const principals = p.sessions.flatMap((s) => s.main.filter((m) => m.role === 'principal'));
    expect(
      principals.every((m) => !fixtureExercise(m.exerciseId).equipment.includes('machine')),
    ).toBe(true);
  });
});

describe('échauffement et retour au calme', () => {
  it('dure 5 + 4 min (3 + 2 pour 20 min), commence par un cardio doux et finit par de la mobilité', () => {
    const seconds = (items: PlannedSession['warmup']) =>
      items.reduce(
        (t, i) =>
          t +
          i.prescription.sets *
            (i.prescription.target.measure === 'duree' ? i.prescription.target.minSeconds : 0),
        0,
      );
    const normal = plan(makePlanInput({ sessionMinutes: 45 }));
    const short = plan(makePlanInput({ sessionMinutes: 20 }));
    for (const s of normal.sessions) {
      expect(s.warmup[0]?.pattern).toBe('cardio');
      expect(s.warmup.slice(1).every((w) => w.pattern === 'mobilite')).toBe(true);
      expect(Math.abs(seconds(s.warmup) - TIMING.warmupMinutes.normal * 60)).toBeLessThanOrEqual(
        15,
      );
      expect(
        Math.abs(seconds(s.cooldown) - TIMING.cooldownMinutes.normal * 60),
      ).toBeLessThanOrEqual(15);
      expect(s.cooldown.every((c) => c.pattern === 'mobilite')).toBe(true);
    }
    for (const s of short.sessions) {
      expect(Math.abs(seconds(s.warmup) - TIMING.warmupMinutes.short * 60)).toBeLessThanOrEqual(15);
      expect(Math.abs(seconds(s.cooldown) - TIMING.cooldownMinutes.short * 60)).toBeLessThanOrEqual(
        15,
      );
    }
  });

  it('cible la mobilité des groupes du jour et évite l’impact pour une condition de santé', () => {
    const p = plan(
      makePlanInput({ frequency: 2, days: [0, 3], level: 'confirme' }, { healthCondition: true }),
    );
    for (const s of p.sessions) {
      for (const w of s.warmup) expect(fixtureExercise(w.exerciseId).tags).not.toContain('impact');
    }
    const upper = plan(makePlanInput({ frequency: 2, days: [5, 6] }));
    const haut = upper.sessions.find((s) => s.kind === 'haut-a');
    const bas = upper.sessions.find((s) => s.kind === 'bas-a');
    const targets = (s?: PlannedSession) =>
      (s?.warmup ?? [])
        .filter((w) => w.pattern === 'mobilite')
        .flatMap((w) => fixtureExercise(w.exerciseId).secondaryMuscles);
    expect(targets(haut)).toEqual(expect.arrayContaining(['epaules']));
    expect(targets(bas)).toEqual(expect.arrayContaining(['fessiers']));
  });

  it('n’ajoute rien aux séances douces, qui restent en cardio, mobilité et équilibre', () => {
    const p = plan(makePlanInput({ frequency: 3, days: [0, 1, 2] }));
    const soft = p.sessions.find((s) => s.kind === 'douce');
    expect(soft).toBeDefined();
    expect(soft?.warmup).toEqual([]);
    expect(soft?.cooldown).toEqual([]);
    for (const m of soft?.main ?? [])
      expect(['cardio', 'mobilite', 'equilibre']).toContain(m.pattern);
    expect(soft?.main.find((m) => m.pattern === 'cardio')?.prescription.sets).toBe(1);
    expect(soft?.heavyGroups).toEqual([]);
    const lightWeek = plan(
      makePlanInput(
        { frequency: 3, days: [0, 1, 2] },
        {},
        { logs: [doneWeek(1), doneWeek(2), doneWeek(3), doneWeek(4)] },
      ),
    );
    expect(
      lightWeek.sessions.find((s) => s.kind === 'douce')?.main.find((m) => m.pattern === 'mobilite')
        ?.prescription.advice,
    ).toBe('semaine-allegee');
  });
});
