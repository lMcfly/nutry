/**
 * QA phase 2 — garde-fous de santé aux bornes exactes et valeurs Mifflin-St Jeor
 * recalculées à la main.
 */
import { describe, expect, it } from 'vitest';
import { makeProfile } from '../testing/fixtures';
import { assessEnergy, computeGentleLossTarget, computePortionFactor } from './index';

const loss = (overrides: Parameters<typeof makeProfile>[0]) =>
  assessEnergy(makeProfile({ goal: 'perdre-en-douceur', ...overrides }));
const codes = (a: ReturnType<typeof assessEnergy>) => a.messages.map((m) => m.code);

describe('QA Mifflin-St Jeor recalculé à la main', () => {
  it('homme 25 ans, 175 cm, 70 kg, sédentaire', () => {
    // 10×70 + 6,25×175 − 5×25 + 5 = 700 + 1093,75 − 125 + 5 = 1673,75
    const a = loss({ sex: 'homme', age: 25, heightCm: 175, weightKg: 70, activity: 'sedentaire' });
    expect(a.bmrKcal).toBe(1673.75);
    expect(a.needsKcal).toBeCloseTo(2008.5, 9); // × 1,2
    expect(a.targetKcal).toBeCloseTo(1707.225, 9); // × 0,85
    expect(a.deficitApplied).toBe(true);
  });

  it('femme 45 ans, 160 cm, 80 kg, modérée', () => {
    // 800 + 1000 − 225 − 161 = 1414 ; × 1,55 = 2191,7 ; × 0,85 = 1862,945
    const a = loss({ sex: 'femme', age: 45, heightCm: 160, weightKg: 80, activity: 'modere' });
    expect(a.bmrKcal).toBe(1414);
    expect(a.needsKcal).toBeCloseTo(2191.7, 9);
    expect(a.targetKcal).toBeCloseTo(1862.945, 9);
  });

  it('« autre » 30 ans, 170 cm, 65 kg, léger : moyenne des constantes (−78)', () => {
    // 650 + 1062,5 − 150 − 78 = 1484,5 ; × 1,375 = 2041,1875 ; × 0,85 = 1735,009375
    const a = loss({ sex: 'autre', age: 30, heightCm: 170, weightKg: 65, activity: 'leger' });
    expect(a.bmrKcal).toBe(1484.5);
    expect(a.needsKcal).toBeCloseTo(2041.1875, 9);
    expect(a.targetKcal).toBeCloseTo(1735.009375, 9);
  });
});

describe('QA déficit et planchers aux bornes', () => {
  it('déficit exactement 15 %', () => {
    expect(computeGentleLossTarget(2000, 'femme')).toBe(1700);
    expect(computeGentleLossTarget(3000, 'homme')).toBe(2550);
  });

  it('plancher pile atteint, juste au-dessus, juste en dessous', () => {
    // 1500 / 0,85 ≈ 1764,7 : au-dessus, le déficit plein s'applique ; en dessous, le plancher.
    expect(computeGentleLossTarget(1800, 'homme')).toBeCloseTo(1530, 9);
    expect(computeGentleLossTarget(1700, 'homme')).toBe(1500);
    expect(computeGentleLossTarget(1500, 'homme')).toBe(1500);
    expect(computeGentleLossTarget(1200, 'femme')).toBe(1200);
    expect(computeGentleLossTarget(1400, 'femme')).toBe(1200);
    expect(computeGentleLossTarget(1412, 'femme')).toBeCloseTo(1200.2, 9);
    expect(computeGentleLossTarget(1500, 'autre')).toBe(1500);
    expect(computeGentleLossTarget(1499, 'autre')).toBe(1499);
  });

  it('la cible n’est jamais sous le plancher ni au-dessus des besoins (balayage)', () => {
    for (const sex of ['homme', 'femme', 'autre'] as const) {
      const floor = sex === 'femme' ? 1200 : 1500;
      for (let needs = 800; needs <= 4000; needs += 7) {
        const target = computeGentleLossTarget(needs, sex);
        expect(target).toBeLessThanOrEqual(needs);
        expect(target).toBeGreaterThanOrEqual(Math.min(needs, floor));
        expect(target).toBeGreaterThanOrEqual(needs * 0.85 - 1e-9);
      }
    }
  });

  it('plancher atteint via le profil complet : déficit appliqué mais limité', () => {
    // femme 60 ans, 158 cm, 58 kg, sédentaire : 580 + 987,5 − 300 − 161 = 1106,5 ; × 1,2 = 1327,8
    const a = loss({ age: 60, heightCm: 158, weightKg: 58, activity: 'sedentaire' });
    expect(a.needsKcal).toBeCloseTo(1327.8, 9);
    expect(a.targetKcal).toBe(1200);
    expect(a.deficitApplied).toBe(true);
  });
});

describe('QA garde-fous aux bornes', () => {
  it('âge 17 → bloqué, 18 → autorisé', () => {
    expect(loss({ age: 17 })).toMatchObject({ perteAutorisee: false, deficitApplied: false });
    expect(codes(loss({ age: 17 }))).toEqual(['mineur']);
    expect(loss({ age: 18 })).toMatchObject({ perteAutorisee: true, deficitApplied: true });
  });

  it('IMC 18,49 → bloqué, 18,5 pile → autorisé (2 m : 73,96 kg / 74 kg)', () => {
    const low = loss({ heightCm: 200, weightKg: 73.96 });
    expect(low.bmi).toBeCloseTo(18.49, 9);
    expect(low).toMatchObject({ perteAutorisee: false, deficitApplied: false });
    expect(low.targetKcal).toBe(low.needsKcal);
    expect(codes(low)).toEqual(['imc-bas']);
    const edge = loss({ heightCm: 200, weightKg: 74 });
    expect(edge.bmi).toBe(18.5);
    expect(edge).toMatchObject({ perteAutorisee: true, deficitApplied: true });
  });

  it('RTT 0,499 → pas d’alerte, 0,5 pile → alerte sans bloquer la perte', () => {
    const under = loss({ heightCm: 200, weightKg: 90, waistCm: 99.8 });
    expect(under.waistToHeightRatio).toBeCloseTo(0.499, 9);
    expect(codes(under)).toEqual([]);
    const at = loss({ heightCm: 200, weightKg: 90, waistCm: 100 });
    expect(at.waistToHeightRatio).toBe(0.5);
    expect(codes(at)).toEqual(['tour-de-taille']);
    expect(at).toMatchObject({ perteAutorisee: true, deficitApplied: true });
  });

  it('grossesse : ignorée pour « homme », effective pour « femme » et « autre »', () => {
    expect(
      loss({ sex: 'homme', pregnantOrBreastfeeding: true, weightKg: 80, heightCm: 180 }),
    ).toMatchObject({ perteAutorisee: true, deficitApplied: true, messages: [] });
    for (const sex of ['femme', 'autre'] as const) {
      const a = loss({ sex, pregnantOrBreastfeeding: true });
      expect(a).toMatchObject({ perteAutorisee: false, deficitApplied: false });
      expect(a.targetKcal).toBe(a.needsKcal);
      expect(codes(a)).toEqual(['grossesse-allaitement']);
    }
  });

  it('cumul : les quatre messages, aucun déficit, ordre stable', () => {
    const a = loss({
      age: 16,
      sex: 'autre',
      pregnantOrBreastfeeding: true,
      heightCm: 160,
      weightKg: 45,
      waistCm: 80,
    });
    expect(codes(a)).toEqual(['mineur', 'grossesse-allaitement', 'imc-bas', 'tour-de-taille']);
    expect(a).toMatchObject({ perteAutorisee: false, deficitApplied: false });
    expect(a.targetKcal).toBe(a.needsKcal);
    expect(a.messages.every((m) => m.suggestProfessional)).toBe(true);
  });

  it('aucun objectif autre que la perte n’applique de déficit, quel que soit le profil', () => {
    for (const goal of ['reequilibrer', 'maintenir', 'energie'] as const) {
      for (const age of [16, 30, 80]) {
        const a = assessEnergy(makeProfile({ goal, age, waistCm: 120 }));
        expect(a.targetKcal).toBe(a.needsKcal);
        expect(a.deficitApplied).toBe(false);
      }
    }
  });

  it('facteur de portion d’un profil protégé : jamais sous 0,8 même avec « trop copieux »', () => {
    const a = loss({ age: 16 });
    expect(computePortionFactor(a.targetKcal, 0.8 ** 3)).toBe(0.8);
  });
});
