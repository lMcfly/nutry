import { describe, expect, it } from 'vitest';
import { createInMemoryPorts } from '../testing';
import { WEIGHT_TRACKING_DISABLED_MESSAGE, createUseCases } from '.';
import type { Profile } from '@domain/profile';
import { makeProfile } from '@domain/testing/fixtures';

const setup = async (profile: Profile | null = makeProfile()) => {
  const ports = createInMemoryPorts();
  const uc = createUseCases(ports);
  if (profile) await uc.saveProfile(profile);
  return { ports, uc };
};

describe('progrès', () => {
  it('enregistre une mesure par semaine et corrige à la même date', async () => {
    const { uc, ports } = await setup();
    await expect(uc.logProgress({ weightKg: 62, waistCm: 75 })).resolves.toEqual({
      status: 'nouvelle',
    });
    await expect(uc.logProgress({ weightKg: 61.5 })).resolves.toEqual({ status: 'correction' });
    ports.clock.set('2026-11-25T10:00:00.000Z');
    const refused = await uc.logProgress({ weightKg: 61 });
    expect(refused.status).toBe('refusee');
    await expect(uc.logProgress({ weightKg: 0 })).resolves.toMatchObject({ status: 'invalide' });
    expect(ports.state.progress.get('2026-11-23')).toEqual({ date: '2026-11-23', weightKg: 61.5 });

    ports.clock.set('2026-11-30T10:00:00.000Z');
    await uc.logProgress({ weightKg: 61, waistCm: 74 });
    const view = await uc.getProgressSummary();
    expect(view.entries).toHaveLength(2);
    expect(view.weightTrend).toHaveLength(2);
    expect(view.waistTrend).toHaveLength(1);
    expect(view.summary.currentStreakWeeks).toBe(2);
    expect(view.weightTracking).toEqual({ enabled: true, enabledByDefault: true });

    await uc.removeProgress('2026-11-30');
    expect((await uc.getProgressSummary()).entries).toHaveLength(1);
  });

  it('respecte le suivi du poids désactivé par défaut (mineur)', async () => {
    const { uc, ports } = await setup(makeProfile({ age: 16 }));
    const view = await uc.getProgressSummary();
    expect(view.weightTracking).toEqual({ enabled: false, enabledByDefault: false });
    await expect(uc.logProgress({ weightKg: 50 })).resolves.toEqual({
      status: 'invalide',
      message: WEIGHT_TRACKING_DISABLED_MESSAGE,
    });
    await expect(uc.logProgress({ waistCm: 60 })).resolves.toEqual({ status: 'nouvelle' });
    expect(ports.state.progress.size).toBe(1);
  });

  it('masque le poids sans l’effacer quand la personne désactive son suivi', async () => {
    const { uc, ports } = await setup();
    await uc.logProgress({ weightKg: 62, waistCm: 75 });
    await expect(uc.setWeightTracking(false)).resolves.toEqual({
      enabled: false,
      enabledByDefault: true,
    });
    const hidden = await uc.getProgressSummary();
    expect(hidden.entries).toEqual([{ date: '2026-11-23', waistCm: 75 }]);
    expect(hidden.weightTrend).toEqual([]);

    await expect(uc.logProgress({ waistCm: 74 })).resolves.toEqual({ status: 'correction' });
    expect(ports.state.progress.get('2026-11-23')).toEqual({
      date: '2026-11-23',
      weightKg: 62,
      waistCm: 74,
    });
    await expect(uc.setWeightTracking(true)).resolves.toMatchObject({ enabled: true });
  });

  it('sans profil : pas de suivi du poids par défaut', async () => {
    const { uc, ports } = await setup(null);
    ports.state.progress.set('2026-11-16', { date: '2026-11-16', weightKg: 60 });
    const view = await uc.getProgressSummary();
    expect(view.weightTracking.enabled).toBe(false);
    expect(view.entries).toEqual([]);
  });
});
