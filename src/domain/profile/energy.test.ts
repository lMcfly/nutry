import { describe, expect, it } from 'vitest';
import { makeProfile } from '../testing/fixtures';
import {
  ACTIVITY_COEFFICIENTS,
  ACTIVITY_LEVELS,
  HEALTH_MESSAGES,
  MEDICAL_DISCLAIMER,
  assessEnergy,
  computeBmi,
  computeBmr,
  computeEnergyNeeds,
  computeGentleLossTarget,
  computeWaistToHeightRatio,
  isPregnancyRelevant,
  isWaistToHeightAlert,
  validateProfile,
} from './index';

describe('IMC et tour de taille', () => {
  it('calcule l’IMC', () => {
    expect(computeBmi(70, 175)).toBeCloseTo(22.857, 3);
    expect(computeBmi(50, 165)).toBeCloseTo(18.365, 3);
  });

  it.each([
    [0, 170],
    [70, 0],
    [-5, 170],
    [Number.NaN, 170],
    [70, Number.POSITIVE_INFINITY],
  ])('refuse des mesures invalides (%s kg, %s cm)', (w, h) => {
    expect(() => computeBmi(w, h)).toThrow(RangeError);
  });

  it('calcule le rapport tour de taille / taille et son seuil 0,5', () => {
    expect(computeWaistToHeightRatio(80, 160)).toBe(0.5);
    expect(isWaistToHeightAlert(0.5)).toBe(true);
    expect(isWaistToHeightAlert(0.499)).toBe(false);
    expect(() => computeWaistToHeightRatio(0, 160)).toThrow(RangeError);
  });
});

describe('Mifflin-St Jeor et besoins', () => {
  it('applique +5 (homme), −161 (femme) et la moyenne pour « autre »', () => {
    const body = { age: 30, heightCm: 180, weightKg: 80 };
    expect(computeBmr({ ...body, sex: 'homme' })).toBe(1780);
    expect(computeBmr({ ...body, sex: 'femme' })).toBe(1614);
    expect(computeBmr({ ...body, sex: 'autre' })).toBe(1697);
  });

  it('refuse des entrées invalides', () => {
    expect(() => computeBmr({ age: 0, sex: 'femme', heightCm: 160, weightKg: 60 })).toThrow(
      RangeError,
    );
    expect(() => computeBmr({ age: 30, sex: 'femme', heightCm: 160, weightKg: -1 })).toThrow(
      RangeError,
    );
  });

  it('expose les 5 coefficients d’activité', () => {
    expect(ACTIVITY_LEVELS.map((a) => ACTIVITY_COEFFICIENTS[a])).toEqual([
      1.2, 1.375, 1.55, 1.725, 1.9,
    ]);
    expect(computeEnergyNeeds(1000, 'modere')).toBe(1550);
  });
});

describe('perte en douceur : déficit plafonné et planchers', () => {
  it('applique 15 % de déficit au plus', () => {
    expect(computeGentleLossTarget(2400, 'homme')).toBe(2040);
  });

  it.each([
    ['homme', 1600, 1500],
    ['autre', 1600, 1500],
    ['femme', 1300, 1200],
  ] as const)('plancher %s : %i kcal de besoins → %i', (sex, needs, target) => {
    expect(computeGentleLossTarget(needs, sex)).toBe(target);
  });

  it('ne dépasse jamais les besoins quand ils sont sous le plancher', () => {
    expect(computeGentleLossTarget(1100, 'femme')).toBe(1100);
    expect(computeGentleLossTarget(1400, 'homme')).toBe(1400);
  });
});

describe('assessEnergy (garde-fous)', () => {
  const adult = makeProfile({
    sex: 'homme',
    age: 30,
    heightCm: 180,
    weightKg: 80,
    activity: 'sedentaire',
  });

  it('reste à l’équilibre hors objectif de perte', () => {
    for (const goal of ['reequilibrer', 'maintenir', 'energie'] as const) {
      const a = assessEnergy({ ...adult, goal });
      expect(a.targetKcal).toBe(a.needsKcal);
      expect(a.deficitApplied).toBe(false);
      expect(a.perteAutorisee).toBe(true);
      expect(a.messages).toEqual([]);
    }
  });

  it('applique le déficit pour « perdre en douceur »', () => {
    const a = assessEnergy({ ...adult, goal: 'perdre-en-douceur' });
    expect(a.bmrKcal).toBe(1780);
    expect(a.needsKcal).toBeCloseTo(2136, 6);
    expect(a.targetKcal).toBeCloseTo(2136 * 0.85, 6);
    expect(a.deficitApplied).toBe(true);
    expect(a.bmi).toBeCloseTo(24.69, 2);
    expect(a.waistToHeightRatio).toBeUndefined();
  });

  it('respecte le plancher femme de 1 200 kcal', () => {
    const a = assessEnergy(
      makeProfile({
        age: 60,
        heightCm: 155,
        weightKg: 50,
        activity: 'sedentaire',
        goal: 'perdre-en-douceur',
      }),
    );
    expect(a.needsKcal).toBeCloseTo(1209.3, 1);
    expect(a.targetKcal).toBe(1200);
  });

  it('n’applique aucun déficit si les besoins sont déjà sous le plancher', () => {
    const a = assessEnergy(
      makeProfile({
        age: 70,
        heightCm: 150,
        weightKg: 45,
        activity: 'sedentaire',
        goal: 'perdre-en-douceur',
      }),
    );
    expect(a.targetKcal).toBe(a.needsKcal);
    expect(a.deficitApplied).toBe(false);
    expect(a.perteAutorisee).toBe(true);
  });

  it.each([
    ['moins de 18 ans', { age: 17 }, 'mineur'],
    ['grossesse (femme)', { pregnantOrBreastfeeding: true }, 'grossesse-allaitement'],
    [
      'allaitement (autre)',
      { sex: 'autre', pregnantOrBreastfeeding: true },
      'grossesse-allaitement',
    ],
    ['IMC < 18,5', { weightKg: 50, heightCm: 168 }, 'imc-bas'],
  ] as const)('%s → aucun déficit, perte grisée, message', (_label, overrides, code) => {
    const a = assessEnergy(makeProfile({ goal: 'perdre-en-douceur', ...overrides }));
    expect(a.targetKcal).toBe(a.needsKcal);
    expect(a.deficitApplied).toBe(false);
    expect(a.perteAutorisee).toBe(false);
    expect(a.messages.map((m) => m.code)).toEqual([code]);
    expect(a.messages[0]?.suggestProfessional).toBe(true);
  });

  it('autorise la perte à 18 ans pile et à IMC 18,5 pile', () => {
    expect(assessEnergy(makeProfile({ age: 18 })).perteAutorisee).toBe(true);
    // À 1,60 m, le seuil de 18,5 correspond à ≈ 47,36 kg.
    expect(assessEnergy(makeProfile({ heightCm: 160, weightKg: 47.4 })).perteAutorisee).toBe(true);
    expect(assessEnergy(makeProfile({ heightCm: 160, weightKg: 47.3 })).perteAutorisee).toBe(false);
  });

  it('signale les garde-fous même si l’objectif n’est pas la perte', () => {
    const a = assessEnergy(makeProfile({ age: 16, goal: 'energie' }));
    expect(a.perteAutorisee).toBe(false);
    expect(a.messages.map((m) => m.code)).toEqual(['mineur']);
  });

  it('cumule plusieurs messages', () => {
    const a = assessEnergy(makeProfile({ age: 17, pregnantOrBreastfeeding: true, weightKg: 45 }));
    expect(a.messages.map((m) => m.code)).toEqual(['mineur', 'grossesse-allaitement', 'imc-bas']);
  });

  it('ignore le drapeau grossesse pour un homme', () => {
    expect(isPregnancyRelevant({ sex: 'homme', pregnantOrBreastfeeding: true })).toBe(false);
    const a = assessEnergy({ ...adult, pregnantOrBreastfeeding: true, goal: 'perdre-en-douceur' });
    expect(a.deficitApplied).toBe(true);
  });

  it('alerte sur le tour de taille sans changer l’objectif', () => {
    const a = assessEnergy({ ...adult, waistCm: 95, goal: 'perdre-en-douceur' });
    expect(a.waistToHeightRatio).toBeCloseTo(0.528, 3);
    expect(a.messages.map((m) => m.code)).toEqual(['tour-de-taille']);
    expect(a.perteAutorisee).toBe(true);
    expect(a.deficitApplied).toBe(true);
    expect(assessEnergy({ ...adult, waistCm: 85 }).messages).toEqual([]);
  });

  it('formule des messages bienveillants et le bandeau médical', () => {
    expect(MEDICAL_DISCLAIMER).toBe(
      'Cette app ne remplace pas l’avis d’un médecin ou d’un diététicien.',
    );
    for (const message of Object.values(HEALTH_MESSAGES)) {
      expect(message.text).not.toMatch(/obès|surpoids|maigre|danger|régime strict|kcal|calorie/i);
    }
    expect(HEALTH_MESSAGES.mineur.text).toMatch(/consulte un professionnel de santé/i);
    expect(HEALTH_MESSAGES['grossesse-allaitement'].text).toMatch(
      /consulte un professionnel de santé/i,
    );
  });
});

describe('validateProfile', () => {
  it('accepte un profil valide', () => {
    expect(validateProfile(makeProfile({ waistCm: 80 }))).toEqual([]);
  });

  it('signale les valeurs impossibles', () => {
    const issues = validateProfile(
      makeProfile({
        age: 0,
        heightCm: Number.NaN,
        weightKg: -3,
        waistCm: 0,
        householdSize: 1.5,
        weekdayMinutes: -1,
        weekendMinutes: Number.POSITIVE_INFINITY,
      }),
    );
    expect(issues.map((i) => i.field)).toEqual([
      'age',
      'heightCm',
      'weightKg',
      'waistCm',
      'householdSize',
      'weekdayMinutes',
      'weekendMinutes',
    ]);
    expect(validateProfile(makeProfile({ householdSize: 0 }))[0]?.field).toBe('householdSize');
  });
});
