import { describe, expect, it } from 'vitest';
import { fixtureExercise } from '../testing/exercises.fixtures';
import { makeProfile } from '../testing/fixtures';
import { makeTraining } from '../testing/training.fixtures';
import {
  assessTrainingSafety,
  plannedSets,
  prescribe,
  type CycleInfo,
  type ExerciseHistoryEntry,
  type TrainingGoal,
  type TrainingLevel,
  type SlotRole,
  type TrainingSafety,
} from '.';

const NORMAL = assessTrainingSafety(makeProfile(), makeTraining());
const PROTECTED = assessTrainingSafety(makeProfile({ healthCondition: true }), makeTraining());
const CYCLE: CycleInfo = {
  activeWeeks: 2,
  blockIndex: 0,
  weekInBlock: 3,
  blockLength: 5,
  deload: false,
};
const DELOAD: CycleInfo = { ...CYCLE, weekInBlock: 5, deload: true, deloadReason: 'cycle' };

/** Une séance passée : chaque série = [répétitions ou secondes, charge]. */
function past(
  day: number,
  sets: readonly [number, number?][],
  measure: 'reps' | 'sec' = 'reps',
): ExerciseHistoryEntry {
  return {
    date: `2026-11-${String(day).padStart(2, '0')}`,
    log: {
      slotId: 'b0-s0',
      exerciseId: 'x',
      done: false,
      sets: sets.map(([value, loadKg], index) => ({
        index,
        done: true,
        ...(measure === 'reps' ? { reps: value } : { seconds: value }),
        ...(loadKg !== undefined ? { loadKg } : {}),
      })),
    },
  };
}

function run(
  id: string,
  history: readonly ExerciseHistoryEntry[],
  options: {
    role?: SlotRole;
    goal?: TrainingGoal;
    level?: TrainingLevel;
    safety?: TrainingSafety;
    cycle?: CycleInfo;
  } = {},
) {
  return prescribe({
    exercise: fixtureExercise(id),
    role: options.role ?? 'principal',
    goal: options.goal ?? 'muscle',
    level: options.level ?? 'intermediaire',
    safety: options.safety ?? NORMAL,
    cycle: options.cycle ?? CYCLE,
    history,
  });
}

describe('prescribe : fourchettes, séries et repos', () => {
  it('suit le schéma de l’objectif et les séries du rôle', () => {
    const p = run('developpe-couche-halteres', []);
    expect(p.sets).toBe(plannedSets('principal', 'intermediaire'));
    expect(p.target).toEqual({ measure: 'repetitions', minReps: 8, maxReps: 12 });
    expect(p.restSeconds).toBe(90);
    expect(run('developpe-couche-halteres', [], { goal: 'force' }).target).toEqual({
      measure: 'repetitions',
      minReps: 6,
      maxReps: 8,
    });
    expect(run('developpe-couche-halteres', [], { goal: 'endurance' }).restSeconds).toBe(45);
    expect(run('developpe-couche-halteres', [], { level: 'confirme' }).sets).toBe(4);
  });

  it('relève la fourchette au plancher d’un débutant (8) ou d’un profil protégé (10)', () => {
    const beginner = assessTrainingSafety(makeProfile(), makeTraining({ level: 'debutant' }));
    expect(
      run('pompes-genoux', [], { goal: 'force', safety: beginner, level: 'debutant' }).target,
    ).toEqual({
      measure: 'repetitions',
      minReps: 8,
      maxReps: 10,
    });
    expect(run('pompes-genoux', [], { goal: 'force', safety: PROTECTED }).target).toEqual({
      measure: 'repetitions',
      minReps: 10,
      maxReps: 12,
    });
    expect(run('pompes-genoux', [], { goal: 'muscle', safety: PROTECTED }).target).toMatchObject({
      minReps: 10,
      maxReps: 12,
    });
  });

  it('ajoute 2 répétitions à un accessoire et réduit son repos de 30 s (45 s au moins)', () => {
    const p = run('curl-halteres', [], { role: 'accessoire' });
    expect(p.target).toEqual({ measure: 'repetitions', minReps: 10, maxReps: 14 });
    expect(p.restSeconds).toBe(60);
    expect(p.sets).toBe(2);
    expect(run('curl-halteres', [], { role: 'accessoire', goal: 'endurance' }).restSeconds).toBe(
      45,
    );
  });

  it('prescrit des secondes pour un exercice en durée', () => {
    const p = run('planche', []);
    expect(p.target).toEqual({ measure: 'duree', minSeconds: 30, maxSeconds: 45 });
    expect(p.restSeconds).toBe(45);
  });

  it('garde 3 répétitions en réserve en intensité modérée ou pour un débutant, 2 sinon', () => {
    expect(run('pompes-genoux', []).repsInReserve).toBe(2);
    expect(run('pompes-genoux', [], { safety: PROTECTED }).repsInReserve).toBe(3);
    expect(run('pompes-genoux', [], { level: 'debutant' }).repsInReserve).toBe(3);
  });
});

describe('prescribe : double progression (exercice chargé)', () => {
  const dumbbell = 'developpe-couche-halteres';

  it('demande de trouver sa charge la première fois, ou sans charge notée', () => {
    expect(run(dumbbell, []).advice).toBe('trouve-ta-charge');
    expect(run(dumbbell, []).loadKg).toBeUndefined();
    expect(run(dumbbell, [past(1, [[10], [10]])]).advice).toBe('trouve-ta-charge');
  });

  it('ignore les séries non faites ou sans mesure', () => {
    const empty: ExerciseHistoryEntry = {
      date: '2026-11-01',
      log: {
        slotId: 's',
        exerciseId: 'x',
        done: false,
        sets: [
          { index: 0, done: false, reps: 12, loadKg: 10 },
          { index: 1, done: true },
        ],
      },
    };
    expect(run(dumbbell, [empty]).advice).toBe('trouve-ta-charge');
  });

  it('ajoute une répétition tant que toutes les séries n’ont pas atteint la borne haute', () => {
    const p = run(dumbbell, [
      past(1, [
        [12, 10],
        [10, 10],
        [9, 10],
      ]),
    ]);
    expect(p.advice).toBe('ajoute-une-repetition');
    expect(p.loadKg).toBe(10);
  });

  it('monte la charge d’un incrément quand toutes les séries sont à la borne haute', () => {
    const p = run(dumbbell, [
      past(1, [
        [12, 10],
        [12, 10],
        [12, 10],
      ]),
    ]);
    expect(p.advice).toBe('augmente-la-charge');
    expect(p.loadKg).toBe(11);
    expect(p.target).toEqual({ measure: 'repetitions', minReps: 8, maxReps: 12 });
  });

  it('utilise l’incrément du matériel : barre 2,5 kg, machine 5 kg, kettlebell 4 kg', () => {
    expect(
      run('rowing-barre', [
        past(1, [
          [12, 40],
          [12, 40],
        ]),
      ]).loadKg,
    ).toBe(42.5);
    expect(
      run('developpe-machine-assis', [
        past(1, [
          [12, 30],
          [13, 30],
        ]),
      ]).loadKg,
    ).toBe(35);
    expect(
      run('kettlebell-swing', [
        past(1, [
          [12, 16],
          [12, 16],
        ]),
      ]).loadKg,
    ).toBe(20);
  });

  it('ne monte pas la charge sur une seule série faite', () => {
    expect(run(dumbbell, [past(1, [[12, 10]])]).advice).toBe('ajoute-une-repetition');
  });

  it('part de la charge la plus légère de la séance passée', () => {
    expect(
      run(dumbbell, [
        past(1, [
          [12, 12],
          [12, 10],
        ]),
      ]).loadKg,
    ).toBe(11);
  });

  it('baisse la charge de 10 % après deux séances sous la borne basse', () => {
    const p = run(dumbbell, [
      past(1, [
        [7, 10],
        [6, 10],
      ]),
      past(3, [
        [7, 10],
        [5, 10],
      ]),
    ]);
    expect(p.advice).toBe('allege');
    expect(p.loadKg).toBe(9);
  });

  it('ne baisse pas après un seul échec, ni si une série a atteint la borne basse', () => {
    expect(
      run(dumbbell, [
        past(1, [[10, 10]]),
        past(3, [
          [7, 10],
          [6, 10],
        ]),
      ]).advice,
    ).toBe('ajoute-une-repetition');
    expect(
      run(dumbbell, [
        past(1, [[7, 10]]),
        past(3, [
          [8, 10],
          [6, 10],
        ]),
      ]).advice,
    ).toBe('ajoute-une-repetition');
    expect(
      run(dumbbell, [
        past(3, [
          [7, 10],
          [6, 10],
        ]),
      ]).loadKg,
    ).toBe(10);
  });

  it('maintient la charge quand la progression de charge est interdite (grossesse, condition de santé)', () => {
    const p = run(
      dumbbell,
      [
        past(1, [
          [12, 10],
          [12, 10],
          [12, 10],
        ]),
      ],
      { safety: PROTECTED },
    );
    expect(p.advice).toBe('maintiens');
    expect(p.loadKg).toBe(10);
    expect(
      run(
        dumbbell,
        [
          past(1, [
            [11, 10],
            [12, 10],
          ]),
        ],
        { safety: PROTECTED },
      ).advice,
    ).toBe('ajoute-une-repetition');
  });

  it('autorise quand même d’alléger un profil protégé', () => {
    const p = run(dumbbell, [past(1, [[5, 10]]), past(3, [[6, 10]])], { safety: PROTECTED });
    expect(p.advice).toBe('allege');
    expect(p.loadKg).toBe(9);
  });

  it('compte comme faites toutes les séries d’un exercice validé d’un geste', () => {
    const entry: ExerciseHistoryEntry = {
      date: '2026-11-01',
      log: {
        slotId: 's',
        exerciseId: 'x',
        done: true,
        sets: [0, 1, 2].map((index) => ({ index, done: false, reps: 12, loadKg: 10 })),
      },
    };
    expect(run(dumbbell, [entry]).advice).toBe('augmente-la-charge');
  });

  it('lit la séance la plus récente de l’historique', () => {
    const p = run(dumbbell, [
      past(1, [
        [12, 10],
        [12, 10],
      ]),
      past(3, [
        [9, 11],
        [9, 11],
      ]),
    ]);
    expect(p.advice).toBe('ajoute-une-repetition');
    expect(p.loadKg).toBe(11);
  });
});

describe('prescribe : semaine allégée', () => {
  it('divise les séries par deux (arrondi au-dessus) et la charge par 0,9, sans progresser', () => {
    const p = run(
      'developpe-couche-halteres',
      [
        past(1, [
          [12, 10],
          [12, 10],
          [12, 10],
        ]),
      ],
      { cycle: DELOAD },
    );
    expect(p.advice).toBe('semaine-allegee');
    expect(p.sets).toBe(2);
    expect(p.loadKg).toBe(9);
    expect(run('curl-halteres', [], { role: 'accessoire', cycle: DELOAD }).sets).toBe(1);
    expect(run('squat-barre', [], { level: 'confirme', cycle: DELOAD }).sets).toBe(2);
  });

  it('ne propose pas de charge sans historique et allège aussi les exercices au poids du corps', () => {
    const p = run('pompes-genoux', [past(1, [[20], [20]])], { cycle: DELOAD });
    expect(p.advice).toBe('semaine-allegee');
    expect(p.loadKg).toBeUndefined();
    expect(run('developpe-couche-halteres', [], { cycle: DELOAD }).loadKg).toBeUndefined();
  });
});

describe('prescribe : poids du corps, élastique et assisté', () => {
  it('commence par « ajoute une répétition » puis monte la borne haute de 2', () => {
    expect(run('pompes-genoux', []).advice).toBe('ajoute-une-repetition');
    expect(run('pompes-genoux', [past(1, [[10], [9]])]).target).toEqual({
      measure: 'repetitions',
      minReps: 8,
      maxReps: 12,
    });
    const up = run('pompes-genoux', [past(1, [[12], [12], [12]])]);
    expect(up.advice).toBe('ajoute-une-repetition');
    expect(up.target).toEqual({ measure: 'repetitions', minReps: 8, maxReps: 14 });
    expect(up.loadKg).toBeUndefined();
    expect(run('pompes-genoux', [past(1, [[17], [17]])]).target).toMatchObject({ maxReps: 19 });
    expect(run('pompes-genoux', [past(1, [[19], [19]])]).target).toMatchObject({ maxReps: 20 });
  });

  it('ne monte pas la borne sur une seule série', () => {
    expect(run('pompes-genoux', [past(1, [[15]])]).target).toMatchObject({ maxReps: 12 });
  });

  it('propose la variante plus difficile à 20 répétitions, ou maintient sans variante', () => {
    expect(run('squat-chaise', [past(1, [[20], [21]])]).advice).toBe('variante-plus-dure');
    expect(run('pompes', [past(1, [[20], [20]])]).advice).toBe('maintiens');
  });

  it('ne change ni la borne ni la variante quand la progression est interdite', () => {
    const top = [past(1, [[12], [12]])];
    expect(run('pompes-genoux', top, { safety: PROTECTED }).advice).toBe('maintiens');
    expect(run('squat-chaise', [past(1, [[20], [20]])], { safety: PROTECTED }).advice).toBe(
      'maintiens',
    );
  });

  it('traite l’élastique comme un poids du corps (pas de charge)', () => {
    const p = run('rowing-elastique', [past(1, [[12], [12]])]);
    expect(p.loadKg).toBeUndefined();
    expect(p.target).toMatchObject({ maxReps: 14 });
  });

  it('traite un exercice assisté comme un poids du corps : la machine ne monte pas de charge', () => {
    const p = run('tractions-assistees', [
      past(1, [
        [12, 30],
        [12, 30],
      ]),
    ]);
    expect(p.loadKg).toBeUndefined();
    expect(p.target).toMatchObject({ maxReps: 14 });
    expect(
      run('dips-assistes-machine', [
        past(1, [
          [20, 20],
          [20, 20],
        ]),
      ]).advice,
    ).toBe('maintiens');
    expect(
      run('tractions-assistees', [
        past(1, [
          [20, 20],
          [20, 20],
        ]),
      ]).advice,
    ).toBe('variante-plus-dure');
  });

  it('allège après deux séances sous la borne basse, sans charge', () => {
    const p = run('pompes-genoux', [past(1, [[5], [4]]), past(3, [[6], [5]])]);
    expect(p.advice).toBe('allege');
    expect(p.loadKg).toBeUndefined();
  });
});

describe('prescribe : exercice en durée', () => {
  it('progresse en tenant plus longtemps, puis passe à la variante ou maintient', () => {
    expect(
      run('planche-genoux', [past(1, [[20], [22]], 'sec')], { level: 'debutant' }).advice,
    ).toBe('ajoute-une-repetition');
    expect(
      run('planche-genoux', [past(1, [[30], [32]], 'sec')], { level: 'debutant' }).advice,
    ).toBe('variante-plus-dure');
    expect(run('planche', [past(1, [[45], [45]], 'sec')]).advice).toBe('maintiens');
    expect(
      run('planche-genoux', [past(1, [[30], [30]], 'sec')], {
        level: 'debutant',
        safety: PROTECTED,
      }).advice,
    ).toBe('maintiens');
  });
});

describe('prescribe : déterminisme', () => {
  it('rend le même résultat pour la même entrée et ne modifie pas l’historique', () => {
    const history = [
      past(1, [
        [12, 10],
        [12, 10],
      ]),
    ];
    const copy = JSON.stringify(history);
    expect(run('developpe-couche-halteres', history)).toEqual(
      run('developpe-couche-halteres', history),
    );
    expect(JSON.stringify(history)).toBe(copy);
  });
});
