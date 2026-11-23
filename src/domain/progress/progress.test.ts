import { describe, expect, it } from 'vitest';
import {
  TREND_SMOOTHING,
  checkProgressEntry,
  computeTrend,
  recordProgress,
  summarizeProgress,
} from './index';
import type { ProgressEntry } from './index';

const TODAY = '2026-11-25'; // mercredi
const entries: ProgressEntry[] = [
  { date: '2026-11-09', weightKg: 70, waistCm: 85 },
  { date: '2026-11-16', weightKg: 69 },
];

describe('une mesure par semaine', () => {
  it('accepte une nouvelle semaine', () => {
    expect(checkProgressEntry(entries, { date: '2026-11-23', weightKg: 68.5 }, TODAY)).toEqual({
      status: 'created',
    });
    expect(checkProgressEntry([], { date: TODAY, waistCm: 84 }, TODAY)).toEqual({
      status: 'created',
    });
  });

  it('une 2e saisie dans la même semaine (lundi → dimanche) met à jour', () => {
    expect(checkProgressEntry(entries, { date: '2026-11-22', weightKg: 69 }, TODAY)).toEqual({
      status: 'updated',
    });
    // Le lundi suivant ouvre une nouvelle semaine, même 1 jour après un dimanche.
    const sunday = [{ date: '2026-11-22', weightKg: 69 }];
    expect(checkProgressEntry(sunday, { date: '2026-11-23', weightKg: 69 }, TODAY).status).toBe(
      'created',
    );
  });

  it('autorise la correction d’une mesure à la même date', () => {
    expect(checkProgressEntry(entries, { date: '2026-11-16', weightKg: 68.8 }, TODAY)).toEqual({
      status: 'updated',
    });
  });

  it.each([
    [{ date: '2026-11-23' }],
    [{ date: '2026-11-23', weightKg: 0 }],
    [{ date: '2026-11-23', waistCm: Number.NaN }],
    [{ date: '2026-11-26', weightKg: 70 }],
  ])('refuse une saisie invalide %o', (entry: ProgressEntry) => {
    expect(checkProgressEntry(entries, entry, TODAY).status).toBe('invalide');
  });

  it('enregistre ou fusionne selon la semaine, en gardant l’ordre chronologique', () => {
    const added = recordProgress(entries, { date: '2026-11-02', weightKg: 71 }, TODAY);
    expect(added.check.status).toBe('created');
    expect(added.entries.map((e) => e.date)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    const corrected = recordProgress(entries, { date: '2026-11-16', weightKg: 68 }, TODAY);
    expect(corrected.entries.at(-1)?.weightKg).toBe(68);
    expect(corrected.entries).toHaveLength(2);
    expect(corrected.replacedDate).toBeUndefined();
    // Même semaine, autre jour : fusion champ par champ, date la plus récente.
    const merged = recordProgress(entries, { date: '2026-11-11', waistCm: 84 }, TODAY);
    expect(merged.check.status).toBe('updated');
    expect(merged.saved).toEqual({ date: '2026-11-11', weightKg: 70, waistCm: 84 });
    expect(merged.replacedDate).toBe('2026-11-09');
    expect(merged.entries.map((e) => e.date)).toEqual(['2026-11-11', '2026-11-16']);
    // Saisie antérieure dans la semaine : la date la plus récente est gardée.
    const thursday = [{ date: '2026-11-12', weightKg: 70 }];
    const earlier = recordProgress(thursday, { date: '2026-11-10', waistCm: 84 }, TODAY);
    expect(earlier.saved).toEqual({ date: '2026-11-12', weightKg: 70, waistCm: 84 });
    expect(earlier.replacedDate).toBeUndefined();
    const invalid = recordProgress(entries, { date: '2026-11-17' }, TODAY);
    expect(invalid.entries).toBe(entries);
    expect(invalid.saved).toBeUndefined();
  });
});

describe('tendance lissée', () => {
  it('applique un lissage exponentiel et ignore les valeurs absentes', () => {
    const series: ProgressEntry[] = [
      { date: '2026-11-16', weightKg: 69 },
      { date: '2026-11-02', weightKg: 71, waistCm: 86 },
      { date: '2026-11-09', waistCm: 85 },
      { date: '2026-11-23', weightKg: 70 },
    ];
    const trend = computeTrend(series, 'weightKg');
    expect(trend.map((p) => p.date)).toEqual(['2026-11-02', '2026-11-16', '2026-11-23']);
    expect(trend[0]?.trend).toBe(71);
    expect(trend[1]?.trend).toBeCloseTo(TREND_SMOOTHING * 69 + (1 - TREND_SMOOTHING) * 71, 10);
    expect(trend[2]?.trend).toBeCloseTo(0.4 * 70 + 0.6 * 70.2, 10);
    expect(computeTrend(series, 'waistCm', 1).map((p) => p.trend)).toEqual([86, 85]);
    expect(computeTrend([], 'weightKg')).toEqual([]);
  });
});

describe('messages de régularité', () => {
  it('invite sans pression quand rien n’est saisi', () => {
    expect(summarizeProgress([], TODAY)).toMatchObject({ weeksTracked: 0, currentStreakWeeks: 0 });
    expect(summarizeProgress([], TODAY).message).toMatch(/une fois par semaine suffit/);
  });

  it('félicite le premier point d’étape', () => {
    expect(summarizeProgress([{ date: '2026-11-24', weightKg: 70 }], TODAY)).toMatchObject({
      weeksTracked: 1,
      currentStreakWeeks: 1,
      message: 'Premier point d’étape noté : bravo de prendre ce temps pour toi.',
    });
  });

  it('valorise une série de semaines consécutives (jusqu’à la semaine dernière)', () => {
    const s = summarizeProgress(
      [
        { date: '2026-11-02', weightKg: 70 },
        { date: '2026-11-09', weightKg: 70 },
        { date: '2026-11-16', weightKg: 70 },
      ],
      TODAY,
    );
    expect(s).toMatchObject({ weeksTracked: 3, currentStreakWeeks: 3 });
    expect(s.message).toBe('3 semaines d’affilée : ta régularité est une vraie force.');
  });

  it('valorise le nombre de semaines suivies sans parler du chiffre', () => {
    const s = summarizeProgress(
      [
        { date: '2026-10-05', weightKg: 75 },
        { date: '2026-11-23', weightKg: 70 },
      ],
      TODAY,
    );
    expect(s).toMatchObject({ weeksTracked: 2, currentStreakWeeks: 1 });
    expect(s.message).toBe('2 semaines suivies : chaque point d’étape compte, à ton rythme.');
    expect(s.message).not.toMatch(/kg|poids|perdu|pris/);
  });
});
