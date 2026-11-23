import { describe, expect, it } from 'vitest';
import type { WeeklyPlan } from '../mealplan';
import type { Profile } from '../profile';
import { makeProfile } from '../testing/fixtures';
import {
  DEFAULT_SETTINGS,
  backupFileName,
  dietaryFingerprint,
  isBackupReminderDue,
  isWeightTrackingEnabled,
  latestInstant,
  mealRatingId,
  planSignature,
  recipeRatingId,
  shoppingBasisKey,
} from '.';

const planOf = (recipeIds: string[], leftoverIndex = -1) =>
  ({
    meals: recipeIds.map((recipeId, i) => ({
      id: `${i}-diner`,
      recipeId,
      isLeftover: i === leftoverIndex,
    })),
  }) as unknown as WeeklyPlan;

describe('dietaryFingerprint', () => {
  it('ne dépend ni de l’ordre, ni des accents, ni des doublons', () => {
    const a = makeProfile({ allergens: ['lait', 'oeufs'], dislikes: ['Céleri', 'navet'] });
    const b = makeProfile({ allergens: ['oeufs', 'lait', 'lait'], dislikes: ['navet', 'celeri'] });
    expect(dietaryFingerprint(a)).toBe(dietaryFingerprint(b));
  });

  it('change avec les régimes, allergies, aliments détestés ou la grossesse', () => {
    const base = makeProfile({ sex: 'femme' });
    const key = dietaryFingerprint(base);
    expect(dietaryFingerprint({ ...base, diets: ['vegan'] })).not.toBe(key);
    expect(dietaryFingerprint({ ...base, allergens: ['arachides'] })).not.toBe(key);
    expect(dietaryFingerprint({ ...base, dislikes: ['chou'] })).not.toBe(key);
    expect(dietaryFingerprint({ ...base, pregnantOrBreastfeeding: true })).not.toBe(key);
  });

  it('ignore ce qui ne filtre pas les recettes', () => {
    const base = makeProfile();
    const other: Profile = { ...base, weightKg: 90, likes: ['saumon'] };
    expect(dietaryFingerprint(other)).toBe(dietaryFingerprint(base));
    expect(dietaryFingerprint({ ...base, dislikes: ['  '] })).toBe(dietaryFingerprint(base));
  });
});

describe('planSignature et shoppingBasisKey', () => {
  it('reflète les recettes et les restes', () => {
    const plan = planOf(['a', 'b']);
    const other = planOf(['a', 'c']);
    const leftover = planOf(['a', 'b'], 1);
    expect(planSignature(plan)).toBe('0-diner=a|1-diner=b');
    expect(planSignature(other)).not.toBe(planSignature(plan));
    expect(planSignature(leftover)).toBe('0-diner=a|1-diner=b*');
  });

  it('change avec le foyer ou le facteur de portion', () => {
    const plan = planOf(['a']);
    const key = shoppingBasisKey({ plan, householdSize: 2, portionFactor: 1 });
    expect(shoppingBasisKey({ plan, householdSize: 3, portionFactor: 1 })).not.toBe(key);
    expect(shoppingBasisKey({ plan, householdSize: 2, portionFactor: 0.95 })).not.toBe(key);
    expect(shoppingBasisKey({ plan, householdSize: 2, portionFactor: 1.0000001 })).toBe(key);
  });
});

describe('réglages', () => {
  it('suit la valeur par défaut du profil sauf choix explicite', () => {
    expect(isWeightTrackingEnabled(DEFAULT_SETTINGS, false)).toBe(false);
    expect(isWeightTrackingEnabled(DEFAULT_SETTINGS, true)).toBe(true);
    expect(isWeightTrackingEnabled({ weightTracking: true }, false)).toBe(true);
    expect(isWeightTrackingEnabled({ weightTracking: false }, true)).toBe(false);
  });
});

describe('isBackupReminderDue', () => {
  const today = '2026-11-23';
  const due = (settings: Partial<typeof DEFAULT_SETTINGS>, hasProfile = true) =>
    isBackupReminderDue({
      hasProfile,
      settings: { ...DEFAULT_SETTINGS, ...settings },
      today,
      localDay: (instant) => instant.slice(0, 10),
    });

  it('jamais sans profil ni date de référence', () => {
    expect(due({ profileCreatedAt: '2026-01-01T10:00:00.000Z' }, false)).toBe(false);
    expect(due({})).toBe(false);
  });

  it('attend 30 jours après l’onboarding ou la dernière sauvegarde', () => {
    expect(due({ profileCreatedAt: '2026-10-25T10:00:00.000Z' })).toBe(false);
    expect(due({ profileCreatedAt: '2026-10-24T10:00:00.000Z' })).toBe(true);
    expect(
      due({ profileCreatedAt: '2026-01-01T10:00:00.000Z', lastBackupAt: '2026-11-01T10:00:00Z' }),
    ).toBe(false);
  });

  it('ne revient pas avant 30 jours, mais reste visible le jour même', () => {
    const old = { lastBackupAt: '2026-01-01T10:00:00.000Z' };
    expect(due({ ...old, lastBackupReminderOn: '2026-11-23' })).toBe(true);
    expect(due({ ...old, lastBackupReminderOn: '2026-11-10' })).toBe(false);
    expect(due({ ...old, lastBackupReminderOn: '2026-10-24' })).toBe(true);
  });
});

describe('utilitaires de sauvegarde', () => {
  it('nomme le fichier selon la date et le chiffrement', () => {
    expect(backupFileName('2026-11-23', false)).toBe('nutry-sauvegarde-2026-11-23.json');
    expect(backupFileName('2026-11-23', true)).toBe('nutry-sauvegarde-2026-11-23.nutry');
  });

  it('identifie les avis', () => {
    expect(mealRatingId('2026-11-23', '2-diner')).toBe('2026-11-23:2-diner');
    expect(recipeRatingId('dahl', '2026-11-23T10:00:00.000Z')).toBe(
      'dahl@2026-11-23T10:00:00.000Z',
    );
  });

  it('garde l’instant le plus récent', () => {
    expect(latestInstant(undefined, undefined)).toBeUndefined();
    expect(latestInstant('2026-01-01', undefined)).toBe('2026-01-01');
    expect(latestInstant(undefined, '2026-01-01')).toBe('2026-01-01');
    expect(latestInstant('2026-02-01', '2026-01-01')).toBe('2026-02-01');
    expect(latestInstant('2026-01-01', '2026-02-01')).toBe('2026-02-01');
  });
});
