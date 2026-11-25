import { describe, expect, it } from 'vitest';
import {
  buildPlanCases,
  freeze,
  planViolations,
  volumeTargetFailures,
  type PlanCase,
} from '@domain/testing/planProperties';
import {
  planTrainingWeek,
  weeklyVolumeByGroup,
  type PlanTrainingWeekInput,
} from '@domain/training';
import { StaticExerciseCatalog } from '../catalog/StaticExerciseCatalog';

/**
 * Les propriétés du planificateur (`plan.test.ts`) rejouées avec le VRAI catalogue embarqué :
 * 48 h, équilibres, plafond de volume, durée, garde-fous, matériel, déterminisme. Un échec ici
 * se corrige dans `exercises.json` (pas dans le domaine) ; les muscles principaux restent
 * parcimonieux (voir `exercises.test.ts`).
 */
const catalog = await new StaticExerciseCatalog('/').getExercises();
const { sweepDays, sweepHealth, all } = buildPlanCases(catalog);

const plan = (c: PlanCase) =>
  planTrainingWeek(freeze(JSON.parse(JSON.stringify(c.input)) as PlanTrainingWeekInput));

describe('planificateur et catalogue réel', () => {
  it('charge le vrai catalogue', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(150);
    expect(all.length).toBe(sweepDays.length + sweepHealth.length);
  });

  it('respecte 48 h, équilibres, volume, durée, garde-fous et matériel dans chaque cas', () => {
    const failures: string[] = [];
    for (const c of all) {
      for (const v of planViolations(c, plan(c), catalog)) failures.push(`${c.label} → ${v}`);
    }
    expect(failures.slice(0, 15)).toEqual([]);
  }, 60_000);

  it('trouve un exercice à chaque créneau, pour tous les cadres et tous les profils', () => {
    const failures: string[] = [];
    for (const c of all) {
      if (plan(c).notices.some((n) => n.code === 'catalogue-insuffisant')) failures.push(c.label);
    }
    expect(failures.slice(0, 15)).toEqual([]);
  }, 60_000);

  it('est déterministe, y compris quand le catalogue arrive dans un autre ordre', () => {
    const failures: string[] = [];
    for (const [i, c] of all.entries()) {
      if (i % 3 !== 0) continue;
      const first = planTrainingWeek(c.input);
      const shuffled = planTrainingWeek({ ...c.input, catalog: [...c.input.catalog].reverse() });
      if (JSON.stringify(first) !== JSON.stringify(shuffled)) failures.push(c.label);
    }
    expect(failures.slice(0, 10)).toEqual([]);
  }, 60_000);

  it('atteint la cible minimale de volume des grands groupes (trois séances de 45 min ou plus)', () => {
    const { checked, failures } = volumeTargetFailures(sweepHealth, catalog);
    expect(checked).toBeGreaterThan(100);
    expect(failures.slice(0, 10)).toEqual([]);
  }, 60_000);

  it('ne dépasse le plafond de volume par groupe dans aucun cas', () => {
    const over: string[] = [];
    for (const c of sweepDays) {
      const volume = weeklyVolumeByGroup(plan(c), catalog);
      const worst = Math.max(...Object.values(volume));
      if (worst > 22) over.push(`${c.label} : ${worst}`);
    }
    expect(over.slice(0, 10)).toEqual([]);
  }, 60_000);
});
