import { describe, expect, it } from 'vitest';
import { EXERCISE_FIXTURES } from '../testing/exercises.fixtures';
import { makePlanInput } from '../testing/training.fixtures';
import { trainingConstraintsKey } from './fingerprint';
import { planTrainingWeek } from './plan';
import { replaceInPlan } from './replace';
import type { SavedTrainingPlan } from './training.types';

describe('replaceInPlan', () => {
  const input = makePlanInput();
  const plan: SavedTrainingPlan = {
    ...planTrainingWeek(input),
    constraintsKey: trainingConstraintsKey(input.profile, input.training),
    generatedAt: '2026-11-23T08:00:00.000Z',
  };
  const session = plan.sessions[0];
  const slot = session?.main[0];
  const other = EXERCISE_FIXTURES.find(
    (e) => e.id !== slot?.exerciseId && e.pattern === slot?.pattern,
  );

  it('remplace seulement le créneau visé, avec sa nouvelle prescription', () => {
    if (!session || !slot || !other) throw new Error('fixture');
    const prescription = { ...slot.prescription, advice: 'maintiens' as const, sets: 2 };
    const next = replaceInPlan(plan, session.id, slot.slotId, other, prescription);
    const changed = next.sessions[0]?.main[0];
    expect(changed).toMatchObject({
      exerciseId: other.id,
      pattern: other.pattern,
      unilateral: other.unilateral,
      prescription,
      role: slot.role,
    });
    expect(next.sessions[0]?.main.slice(1)).toEqual(session.main.slice(1));
    expect(next.sessions.slice(1)).toEqual(plan.sessions.slice(1));
    expect(plan.sessions[0]?.main[0]?.exerciseId).toBe(slot.exerciseId);
  });

  it('séance ou créneau inconnu : programme inchangé', () => {
    if (!session || !slot || !other) throw new Error('fixture');
    expect(replaceInPlan(plan, 'inconnue', slot.slotId, other, slot.prescription)).toEqual(plan);
    expect(replaceInPlan(plan, session.id, 'zz', other, slot.prescription)).toEqual(plan);
  });
});
