/** Garde-fous complémentaires validés par l'utilisateur (ADR 0007). */
import { describe, expect, it } from 'vitest';
import { makeProfile } from '../testing/fixtures';
import {
  HEALTH_MESSAGES,
  SENIOR_AGE,
  assessEnergy,
  computeUserPortionFactor,
  isWeightTrackingEnabledByDefault,
  lowBmiThreshold,
} from './index';

const loss = (overrides: Parameters<typeof makeProfile>[0]) =>
  assessEnergy(makeProfile({ goal: 'perdre-en-douceur', ...overrides }));
const codes = (a: ReturnType<typeof assessEnergy>) => a.messages.map((m) => m.code);

describe('seuil d’IMC bas à partir de 70 ans', () => {
  it('vaut 18,5 jusqu’à 69 ans et 22 dès 70 ans', () => {
    expect(SENIOR_AGE).toBe(70);
    expect(lowBmiThreshold(69)).toBe(18.5);
    expect(lowBmiThreshold(70)).toBe(22);
  });

  // 2 m : IMC = poids / 4.
  it('70 ans, IMC 21,99 → perte désactivée, message adapté ; IMC 22 pile → autorisée', () => {
    const low = loss({ age: 70, heightCm: 200, weightKg: 87.96 });
    expect(low.bmi).toBeCloseTo(21.99, 9);
    expect(low).toMatchObject({
      perteAutorisee: false,
      deficitApplied: false,
      protectedProfile: true,
    });
    expect(low.targetKcal).toBe(low.needsKcal);
    expect(codes(low)).toEqual(['imc-bas-senior']);
    const edge = loss({ age: 70, heightCm: 200, weightKg: 88 });
    expect(edge.bmi).toBe(22);
    expect(edge).toMatchObject({
      perteAutorisee: true,
      deficitApplied: true,
      protectedProfile: false,
    });
  });

  it('69 ans, IMC 21 → seuil adulte, perte autorisée', () => {
    expect(loss({ age: 69, heightCm: 200, weightKg: 84 })).toMatchObject({ perteAutorisee: true });
    expect(codes(loss({ age: 69, heightCm: 200, weightKg: 73.96 }))).toEqual(['imc-bas']);
  });

  it('formule un message bienveillant, sans mot anxiogène, avec invitation au médecin', () => {
    const text = HEALTH_MESSAGES['imc-bas-senior'].text;
    expect(text).not.toMatch(/dénutri|maigre|danger|risque|insuffisan/i);
    expect(text).toMatch(/médecin/);
  });
});

describe('condition de santé déclarée', () => {
  it('aucun déficit, perte non autorisée, invitation à consulter', () => {
    const a = loss({ healthCondition: true, sex: 'homme', heightCm: 180, weightKg: 90 });
    expect(a).toMatchObject({
      perteAutorisee: false,
      deficitApplied: false,
      protectedProfile: true,
    });
    expect(a.targetKcal).toBe(a.needsKcal);
    expect(codes(a)).toEqual(['condition-sante']);
    expect(HEALTH_MESSAGES['condition-sante'].text).toMatch(/médecin/);
    expect(HEALTH_MESSAGES['condition-sante'].suggestProfessional).toBe(true);
  });

  it('facultatif : absent ou faux ne change rien', () => {
    const absent = loss({ sex: 'homme', heightCm: 180, weightKg: 90 });
    expect(absent).toMatchObject({
      perteAutorisee: true,
      deficitApplied: true,
      protectedProfile: false,
    });
    expect(loss({ healthCondition: false, sex: 'homme', heightCm: 180, weightKg: 90 })).toEqual(
      absent,
    );
  });
});

describe('profil protégé et portions', () => {
  it.each([
    ['mineur', { age: 17 }],
    ['grossesse', { pregnantOrBreastfeeding: true }],
    ['condition de santé', { healthCondition: true }],
    ['IMC bas', { heightCm: 170, weightKg: 50 }],
    ['IMC bas après 70 ans', { age: 75, heightCm: 160, weightKg: 54 }],
  ] as const)('%s : facteur ≥ 1, « trop copieux » ignoré', (_label, overrides) => {
    const a = assessEnergy(makeProfile({ activity: 'sedentaire', ...overrides }));
    expect(a.protectedProfile).toBe(true);
    expect(a.targetKcal).toBeLessThan(2000);
    expect(computeUserPortionFactor(a)).toBe(1);
    expect(computeUserPortionFactor(a, 0.8)).toBe(1);
  });

  it('profil protégé à besoins élevés : le facteur peut augmenter (≤ 1,3)', () => {
    expect(computeUserPortionFactor({ targetKcal: 2400, protectedProfile: true }, 0.8)).toBeCloseTo(
      1.2,
      10,
    );
    expect(computeUserPortionFactor({ targetKcal: 4000, protectedProfile: true })).toBe(1.3);
  });

  it('profil non protégé : facteur réduit et ajustement appris appliqué', () => {
    const a = assessEnergy(makeProfile({ activity: 'actif' }));
    expect(a.protectedProfile).toBe(false);
    expect(a.targetKcal).toBeGreaterThan(1600);
    expect(computeUserPortionFactor(a)).toBeCloseTo(a.targetKcal / 2000, 10);
    expect(
      computeUserPortionFactor({ targetKcal: 2000, protectedProfile: false }, 0.9),
    ).toBeCloseTo(0.9, 10);
  });

  it('l’alerte tour de taille seule ne rend pas le profil protégé', () => {
    expect(assessEnergy(makeProfile({ waistCm: 100 })).protectedProfile).toBe(false);
  });
});

describe('suivi du poids par défaut', () => {
  it('désactivé avant 18 ans ou avec une condition de santé, activé sinon', () => {
    expect(isWeightTrackingEnabledByDefault({ age: 17 })).toBe(false);
    expect(isWeightTrackingEnabledByDefault({ age: 18 })).toBe(true);
    expect(isWeightTrackingEnabledByDefault({ age: 40, healthCondition: true })).toBe(false);
    expect(isWeightTrackingEnabledByDefault({ age: 80, healthCondition: false })).toBe(true);
    expect(assessEnergy(makeProfile({ age: 16 })).weightTrackingEnabledByDefault).toBe(false);
    expect(assessEnergy(makeProfile()).weightTrackingEnabledByDefault).toBe(true);
    // Pas d'âge minimum bloquant : un profil de 12 ans reste évaluable.
    expect(() => assessEnergy(makeProfile({ age: 12, heightCm: 150, weightKg: 40 }))).not.toThrow();
  });
});
