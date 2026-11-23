/**
 * QA — imports durcis (décision du coordinateur) : instants en UTC (`Z`) seulement, rien
 * de daté après l'export (+ 1 jour), repas uniques et datés selon leur jour.
 */
import { describe, expect, it } from 'vitest';
import { createInMemoryPorts } from '@application/testing';
import { createUseCases } from '@application/usecases';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';
import { SystemClock, localIsoDate } from '../clock/SystemClock';
import { parseBackupFile } from './backupSchema';

interface Raw {
  exportedAt: string;
  plans: { weekStart: string; generatedAt: string; meals: { id: string; date: string }[] }[];
  ratings: { ratedAt: string; weekStart?: string }[];
  progress: { date: string }[];
  quiz: { daily?: { date: string } };
  shopping: { weekStart: string }[];
  settings: Record<string, unknown>;
}

async function backup(): Promise<Raw> {
  const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES });
  const uc = createUseCases(ports);
  await uc.saveProfile(makeProfile());
  const view = await uc.getCurrentPlan();
  if (view.status !== 'ready') throw new Error('menu attendu');
  await uc.rateMeal({
    weekStart: view.plan.weekStart,
    mealId: view.plan.meals[0]?.id ?? '',
    verdict: 'up',
  });
  await uc.getShoppingList();
  await uc.logProgress({ waistCm: 70 });
  await uc.exportData();
  return JSON.parse(ports.fileSaver.files[0]?.content ?? '') as Raw;
}

const errors = (raw: unknown) => {
  const result = parseBackupFile(raw);
  return result.ok ? [] : result.errors.join('\n');
};

describe('QA imports durcis', () => {
  it('une vraie sauvegarde passe (repas du menu jusqu’au dimanche compris)', async () => {
    const raw = await backup();
    expect(raw.exportedAt).toBe('2026-11-23T10:00:00.000Z');
    expect(raw.plans[0]?.meals.at(-1)?.date).toBe('2026-11-29');
    expect(errors(raw)).toEqual([]);
  });

  it('instants : uniquement en UTC (Z)', async () => {
    const raw = await backup();
    for (const ratedAt of ['2026-11-23T11:00:00+01:00', '2026-11-23T10:00:00', '2026-11-23']) {
      const bad = { ...raw, ratings: [{ ...raw.ratings[0], ratedAt }] };
      expect(errors(bad), ratedAt).toContain('ratings.0.ratedAt');
    }
    const ok = { ...raw, ratings: [{ ...raw.ratings[0], ratedAt: '2026-11-23T09:00Z' }] };
    expect(errors(ok)).toEqual([]);
  });

  it('rien après l’export + 1 jour', async () => {
    const raw = await backup();
    const plan = raw.plans[0];
    const variants: [string, unknown][] = [
      [
        'ratings.0.ratedAt',
        { ...raw, ratings: [{ ...raw.ratings[0], ratedAt: '2026-11-24T10:00:01.000Z' }] },
      ],
      ['progress.0.date', { ...raw, progress: [{ date: '2026-11-25', waistCm: 70 }] }],
      [
        'settings.lastBackupAt',
        { ...raw, settings: { ...raw.settings, lastBackupAt: '2099-01-01T00:00:00.000Z' } },
      ],
      [
        'settings.profileCreatedAt',
        { ...raw, settings: { ...raw.settings, profileCreatedAt: '2027-01-01T00:00:00.000Z' } },
      ],
      [
        'settings.lastBackupReminderOn',
        { ...raw, settings: { ...raw.settings, lastBackupReminderOn: '2026-12-01' } },
      ],
      [
        'plans.0.generatedAt',
        { ...raw, plans: [{ ...plan, generatedAt: '2026-12-01T00:00:00.000Z' }] },
      ],
      [
        'quiz.daily.date',
        { ...raw, quiz: { ...raw.quiz, daily: { date: '2026-12-01', questionId: 'q' } } },
      ],
      [
        'shopping.0.weekStart',
        { ...raw, shopping: [{ ...raw.shopping[0], weekStart: '2026-11-30' }] },
      ],
    ];
    for (const [path, bad] of variants) expect(errors(bad), path).toContain(path);
    // Marge d'un jour : tolérée.
    const margin = {
      ...raw,
      ratings: [{ ...raw.ratings[0], ratedAt: '2026-11-24T10:00:00.000Z' }],
    };
    expect(errors(margin)).toEqual([]);
  });

  it('repas : identifiants uniques et date cohérente avec le jour', async () => {
    const raw = await backup();
    const plan = raw.plans[0];
    if (!plan) throw new Error('menu attendu');
    const [first, second, ...rest] = plan.meals;
    if (!first || !second) throw new Error('repas attendus');
    const dup = {
      ...raw,
      plans: [{ ...plan, meals: [first, { ...second, id: first.id }, ...rest] }],
    };
    expect(errors(dup)).toContain('plans.0.meals.1.id: repas en double');
    const shifted = {
      ...raw,
      plans: [{ ...plan, meals: [{ ...first, date: '2026-11-24' }, second, ...rest] }],
    };
    expect(errors(shifted)).toContain('plans.0.meals.0.date');
  });

  it('données déjà invalides : pas d’exception pendant le contrôle de cohérence', async () => {
    const raw = await backup();
    expect(() => parseBackupFile({ ...raw, exportedAt: 'hier' })).not.toThrow();
    expect(() =>
      parseBackupFile({ ...raw, plans: [{ ...raw.plans[0], weekStart: '2026-02-30' }] }),
    ).not.toThrow();
  });
});

describe('QA SystemClock.dayOf', () => {
  it('jour local d’un instant, comme today()', () => {
    const clock = new SystemClock();
    const instant = new Date(2026, 0, 5, 0, 30);
    expect(clock.dayOf(instant)).toBe('2026-01-05');
    expect(clock.dayOf(clock.now())).toBe(localIsoDate(clock.now()));
  });
});
