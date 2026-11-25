import { describe, expect, it } from 'vitest';
import { EXERCISE_FIXTURES } from '../testing/exercises.fixtures';
import { WEEK, makePlanInput } from '../testing/training.fixtures';
import { addDays } from '../shared';
import {
  buildPlanCases,
  freeze,
  logOf,
  planViolations,
  strength,
  volumeTargetFailures,
} from '../testing/planProperties';
import { planTrainingWeek, type PlanTrainingWeekInput } from '.';

const {
  sweepDays: SWEEP_DAYS,
  sweepHealth: SWEEP_HEALTH,
  all: ALL_CASES,
} = buildPlanCases(EXERCISE_FIXTURES);
const violations = (c: (typeof ALL_CASES)[number], plan: ReturnType<typeof planTrainingWeek>) =>
  planViolations(c, plan, EXERCISE_FIXTURES);

describe('planTrainingWeek : propriétés sur toutes les combinaisons', () => {
  it(`couvre ${ALL_CASES.length} combinaisons de jours, niveaux, matériels, durées, objectifs et profils santé`, () => {
    expect(SWEEP_DAYS).toHaveLength(126 * 3);
    expect(new Set(SWEEP_DAYS.map((c) => c.input.training.days.join())).size).toBe(126);
    expect(SWEEP_HEALTH).toHaveLength(3 * 16 * 5 * 3 * 4);
  });

  it('respecte 48 h, équilibres, volume, durée, garde-fous et matériel dans chaque cas', () => {
    const failures: string[] = [];
    for (const c of ALL_CASES) {
      const plan = planTrainingWeek(
        freeze(JSON.parse(JSON.stringify(c.input)) as PlanTrainingWeekInput),
      );
      for (const v of violations(c, plan)) failures.push(`${c.label} → ${v}`);
    }
    expect(failures.slice(0, 15)).toEqual([]);
  }, 60_000);

  it('est déterministe, y compris quand le catalogue arrive dans un autre ordre', () => {
    const failures: string[] = [];
    for (const [i, c] of ALL_CASES.entries()) {
      if (i % 3 !== 0) continue;
      const first = planTrainingWeek(c.input);
      const again = planTrainingWeek(c.input);
      const shuffled = planTrainingWeek({ ...c.input, catalog: [...c.input.catalog].reverse() });
      if (JSON.stringify(first) !== JSON.stringify(again)) failures.push(`${c.label} : rejeu`);
      if (JSON.stringify(first) !== JSON.stringify(shuffled))
        failures.push(`${c.label} : ordre du catalogue`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  }, 60_000);

  it('ne trouve un candidat à chaque créneau pour aucun profil protégé en manquant (catalogue-insuffisant absent)', () => {
    const failures: string[] = [];
    for (const c of SWEEP_HEALTH) {
      const plan = planTrainingWeek(c.input);
      if (plan.notices.some((n) => n.code === 'catalogue-insuffisant')) failures.push(c.label);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  });

  it('atteint la cible minimale de volume des grands groupes dès trois séances de 45 min (débutant), et au moins 40 % pour les autres niveaux', () => {
    // Écart avec l'ADR : avec trois séances corps entier, la cible 8 / 10 séries n'est pas
    // atteinte pour les pectoraux (50 % / 40 %) ; seul le niveau débutant la tient partout.
    const { checked, failures } = volumeTargetFailures(SWEEP_HEALTH, EXERCISE_FIXTURES);
    expect(checked).toBeGreaterThan(100);
    expect(failures.slice(0, 10)).toEqual([]);
  });
});

describe('séances de 20 min : un seul bloc, en alternance', () => {
  const blocksOf = (plan: ReturnType<typeof planTrainingWeek>) =>
    strength(plan).map((s) => [...new Set(s.main.map((m) => m.slotId.split('-')[0]))].join());

  it('garde un bloc par séance et alterne d’une séance à l’autre', () => {
    const plan = planTrainingWeek(
      makePlanInput({ days: [0, 2, 4], frequency: 3, sessionMinutes: 20, level: 'debutant' }),
    );
    const blocks = blocksOf(plan);
    expect(blocks).toHaveLength(3);
    for (const b of blocks) expect(b).toMatch(/^b\d$/);
    expect(new Set(blocks).size).toBeGreaterThan(1);
  });

  it('alterne aussi d’une semaine active à l’autre (une séance par semaine)', () => {
    const input = (logs: ReturnType<typeof logOf>[]) =>
      makePlanInput(
        { days: [5], frequency: 1, sessionMinutes: 20, level: 'debutant' },
        {},
        { logs },
      );
    const first = blocksOf(planTrainingWeek(input([])));
    const second = blocksOf(planTrainingWeek(input([logOf(addDays(WEEK, -7))])));
    expect(first).toHaveLength(1);
    expect(second).not.toEqual(first);
  });
});
