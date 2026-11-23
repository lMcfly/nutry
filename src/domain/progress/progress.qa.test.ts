/**
 * QA phase 2 — progrès : au plus une saisie par semaine, tendance lissée recalculée à la
 * main, messages jamais culpabilisants.
 */
import { describe, expect, it } from 'vitest';
import { addDays, startOfWeek } from '../shared';
import { computeTrend, recordProgress, summarizeProgress } from './index';
import type { ProgressEntry } from './index';

const GUILT =
  /trop|échec|raté|dommage|attention|interdit|erreur|il faut|devrais|oubli|grossi|perdu/i;

describe('QA progrès', () => {
  it('saisie quotidienne pendant 8 semaines : exactement une mesure acceptée par semaine', () => {
    let entries: readonly ProgressEntry[] = [];
    const start = '2026-09-02'; // un mercredi
    for (let d = 0; d < 56; d += 1) {
      const date = addDays(start, d);
      const result = recordProgress(entries, { date, weightKg: 80 - d * 0.05 }, date);
      if (result.check.status === 'refusee') {
        expect(result.check.message).not.toMatch(GUILT);
        expect(result.check.nextAllowedDate).toBe(addDays(startOfWeek(date), 7));
      }
      entries = result.entries;
    }
    const weeks = entries.map((e) => startOfWeek(e.date));
    expect(new Set(weeks).size).toBe(weeks.length);
    expect(entries).toHaveLength(9); // mercredi 2/09 → mardi 27/10 : 9 semaines calendaires
  });

  it('dimanche puis lundi : deux semaines différentes, acceptées', () => {
    const sunday = recordProgress([], { date: '2026-11-22', weightKg: 70 }, '2026-11-22');
    const monday = recordProgress(
      sunday.entries,
      { date: '2026-11-23', weightKg: 70 },
      '2026-11-23',
    );
    expect(monday.check.status).toBe('nouvelle');
    expect(monday.entries).toHaveLength(2);
  });

  it('correction à la même date : remplace sans doublon', () => {
    const first = recordProgress([], { date: '2026-11-23', weightKg: 70 }, '2026-11-25');
    const fixed = recordProgress(
      first.entries,
      { date: '2026-11-23', weightKg: 69.5 },
      '2026-11-25',
    );
    expect(fixed.check.status).toBe('correction');
    expect(fixed.entries).toEqual([{ date: '2026-11-23', weightKg: 69.5 }]);
  });

  it('tendance lissée recalculée à la main (α = 0,4), mesures manquantes ignorées', () => {
    const entries: ProgressEntry[] = [
      { date: '2026-11-16', weightKg: 78 },
      { date: '2026-11-02', weightKg: 80 },
      { date: '2026-11-09', waistCm: 90 },
      { date: '2026-11-23', weightKg: 79 },
    ];
    const trend = computeTrend(entries, 'weightKg');
    // t0 = 80 ; t1 = 0,4×78 + 0,6×80 = 79,2 ; t2 = 0,4×79 + 0,6×79,2 = 79,12
    expect(trend.map((p) => p.date)).toEqual(['2026-11-02', '2026-11-16', '2026-11-23']);
    expect(trend[0]?.trend).toBe(80);
    expect(trend[1]?.trend).toBeCloseTo(79.2, 12);
    expect(trend[2]?.trend).toBeCloseTo(79.12, 12);
    // La tendance amortit une variation brusque : elle reste entre min et max des mesures.
    for (const p of trend) {
      expect(p.trend).toBeGreaterThanOrEqual(78);
      expect(p.trend).toBeLessThanOrEqual(80);
    }
  });

  it('messages valorisant la régularité, jamais le chiffre ni la culpabilité', () => {
    const today = '2026-11-25';
    const histories: ProgressEntry[][] = [
      [],
      [{ date: '2026-11-23', weightKg: 70 }],
      [
        { date: '2026-09-01', weightKg: 70 },
        { date: '2026-09-08', weightKg: 71 },
      ],
      Array.from({ length: 5 }, (_, i) => ({
        date: addDays('2026-10-26', i * 7),
        weightKg: 70 + i,
      })),
    ];
    for (const h of histories) {
      const { message } = summarizeProgress(h, today);
      expect(message).not.toMatch(GUILT);
      expect(message).not.toMatch(/kg|cm|poids|kilo/i);
    }
    // Pause de plusieurs semaines : pas de reproche, la série repart simplement.
    const paused = summarizeProgress(histories[2] ?? [], today);
    expect(paused.currentStreakWeeks).toBe(0);
    expect(paused.message).toMatch(/2 semaines suivies/);
  });
});
