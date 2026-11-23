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
      status: 'created',
    });
    await expect(uc.logProgress({ weightKg: 61.5 })).resolves.toEqual({ status: 'updated' });
    expect(ports.state.progress.get('2026-11-23')).toEqual({
      date: '2026-11-23',
      weightKg: 61.5,
      waistCm: 75,
    });
    ports.clock.set('2026-11-25T10:00:00.000Z');
    await expect(uc.logProgress({ waistCm: 74.5 })).resolves.toEqual({ status: 'updated' });
    await expect(uc.logProgress({ weightKg: 0 })).resolves.toMatchObject({ status: 'invalide' });
    expect([...ports.state.progress.values()]).toEqual([
      { date: '2026-11-25', weightKg: 61.5, waistCm: 74.5 },
    ]);

    ports.clock.set('2026-11-30T10:00:00.000Z');
    await uc.logProgress({ weightKg: 61, waistCm: 74 });
    const view = await uc.getProgressSummary();
    expect(view.entries).toHaveLength(2);
    expect(view.weightTrend).toHaveLength(2);
    expect(view.waistTrend).toHaveLength(2);
    expect(view.summary.currentStreakWeeks).toBe(2);
    expect(view.weightTracking).toEqual({ enabled: true, enabledByDefault: true });

    expect(view.thisWeekEntry).toEqual({ date: '2026-11-30', weightKg: 61, waistCm: 74 });

    await uc.removeProgress('2026-11-30');
    const after = await uc.getProgressSummary();
    expect(after.entries).toHaveLength(1);
    // La mesure du 25 appartient à la semaine précédente.
    expect(after.thisWeekEntry).toBeUndefined();
  });

  it('respecte le suivi du poids désactivé par défaut (mineur)', async () => {
    const { uc, ports } = await setup(makeProfile({ age: 16 }));
    const view = await uc.getProgressSummary();
    expect(view.weightTracking).toEqual({ enabled: false, enabledByDefault: false });
    await expect(uc.logProgress({ weightKg: 50 })).resolves.toEqual({
      status: 'invalide',
      message: WEIGHT_TRACKING_DISABLED_MESSAGE,
    });
    await expect(uc.logProgress({ waistCm: 60 })).resolves.toEqual({ status: 'created' });
    expect(ports.state.progress.size).toBe(1);
  });

  it('masque le poids par défaut pour tout profil protégé, aux bornes près', async () => {
    const cases: [string, Profile, boolean][] = [
      ['standard', makeProfile(), true],
      ['grossesse', makeProfile({ sex: 'femme', pregnantOrBreastfeeding: true }), false],
      ['condition de santé', makeProfile({ healthCondition: true }), false],
      // 2 m : IMC = poids / 4.
      ['IMC 18,49', makeProfile({ age: 40, heightCm: 200, weightKg: 73.96 }), false],
      ['IMC 18,5', makeProfile({ age: 40, heightCm: 200, weightKg: 74 }), true],
      ['69 ans, IMC 21,9', makeProfile({ age: 69, heightCm: 200, weightKg: 87.6 }), true],
      ['70 ans, IMC 21,9', makeProfile({ age: 70, heightCm: 200, weightKg: 87.6 }), false],
      ['70 ans, IMC 22', makeProfile({ age: 70, heightCm: 200, weightKg: 88 }), true],
    ];
    for (const [label, profile, expected] of cases) {
      const { uc } = await setup(profile);
      const view = await uc.getProgressSummary();
      expect(view.weightTracking, label).toEqual({
        enabled: expected,
        enabledByDefault: expected,
      });
      expect(uc.previewProfile(profile).health?.weightTrackingEnabledByDefault, label).toBe(
        expected,
      );
    }
  });

  it('le choix explicite prime sur le défaut d’un profil protégé (IMC bas senior)', async () => {
    const { uc } = await setup(makeProfile({ age: 72, heightCm: 200, weightKg: 87.6 }));
    await expect(uc.logProgress({ weightKg: 87.6 })).resolves.toMatchObject({
      status: 'invalide',
    });
    await expect(uc.setWeightTracking(true)).resolves.toEqual({
      enabled: true,
      enabledByDefault: false,
    });
    await expect(uc.logProgress({ weightKg: 87.6 })).resolves.toEqual({ status: 'created' });
    expect((await uc.getProgressSummary()).weightTrend).toHaveLength(1);
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

    await expect(uc.logProgress({ waistCm: 74 })).resolves.toEqual({ status: 'updated' });
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
