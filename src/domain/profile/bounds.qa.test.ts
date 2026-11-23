/** QA — bornes de plausibilité du profil (décision du 2026-11-23). */
import { describe, expect, it } from 'vitest';
import { PROFILE_BOUNDS, validateProfile } from './index';
import type { ProfileField } from './index';
import { makeProfile } from '../testing/fixtures';

const fields = Object.keys(PROFILE_BOUNDS) as ProfileField[];

describe('QA bornes du profil', () => {
  it('valeurs décidées', () => {
    expect(PROFILE_BOUNDS).toEqual({
      age: { min: 10, max: 120 },
      heightCm: { min: 100, max: 250 },
      weightKg: { min: 25, max: 350 },
      waistCm: { min: 40, max: 200 },
      householdSize: { min: 1, max: 12 },
      weekdayMinutes: { min: 5, max: 240 },
      weekendMinutes: { min: 5, max: 240 },
    });
  });

  it.each(fields)('%s : bornes incluses, juste dehors refusé avec un message clair', (field) => {
    const { min, max } = PROFILE_BOUNDS[field];
    expect(validateProfile(makeProfile({ [field]: min }))).toEqual([]);
    expect(validateProfile(makeProfile({ [field]: max }))).toEqual([]);
    const step = field === 'householdSize' ? 1 : 0.5;
    for (const value of [min - step, max + step, Number.NaN, Number.POSITIVE_INFINITY]) {
      const issues = validateProfile(makeProfile({ [field]: value }));
      expect(
        issues.map((i) => i.field),
        `${field}=${value}`,
      ).toEqual([field]);
      expect(issues[0]?.message).toMatch(new RegExp(`entre ${min} et ${max}|de ${min} à ${max}`));
    }
  });

  it('tour de taille facultatif ; foyer entier', () => {
    expect(validateProfile(makeProfile({}))).toEqual([]);
    expect(validateProfile(makeProfile({ householdSize: 2.5 })).map((i) => i.field)).toEqual([
      'householdSize',
    ]);
  });
});
