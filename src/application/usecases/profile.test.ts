import { describe, expect, it } from 'vitest';
import { createInMemoryPorts } from '../testing';
import { createUseCases } from '.';
import { MEDICAL_DISCLAIMER } from '@domain/profile';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';

const setup = () => {
  const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES });
  return { ports, uc: createUseCases(ports) };
};

describe('profil', () => {
  it('n’a pas de profil avant l’onboarding', async () => {
    const { uc } = setup();
    await expect(uc.getProfile()).resolves.toBeUndefined();
  });

  it('refuse un profil invalide sans rien enregistrer', async () => {
    const { uc, ports } = setup();
    const result = await uc.saveProfile(makeProfile({ age: -1 }));
    expect(result.status).toBe('invalid');
    expect(ports.state.profile).toBeUndefined();
  });

  it('enregistre le premier profil et date la fin de l’onboarding', async () => {
    const { uc, ports } = setup();
    const result = await uc.saveProfile(makeProfile());
    expect(result).toMatchObject({ status: 'saved', firstProfile: true });
    expect(ports.state.settings.profileCreatedAt).toBe('2026-11-23T10:00:00.000Z');

    ports.clock.set('2026-12-01T10:00:00.000Z');
    const again = await uc.saveProfile(makeProfile({ weightKg: 64 }));
    expect(again).toMatchObject({ status: 'saved', firstProfile: false });
    expect(ports.state.settings.profileCreatedAt).toBe('2026-11-23T10:00:00.000Z');
    expect((await uc.getProfile())?.profile.weightKg).toBe(64);
  });

  it('expose les garde-fous sans kcal, et le détail chiffré à part', async () => {
    const { uc } = setup();
    await uc.saveProfile(makeProfile({ age: 16, goal: 'perdre-en-douceur', waistCm: 70 }));
    const view = await uc.getProfile();
    expect(view?.health).toMatchObject({
      lossAllowed: false,
      protectedProfile: true,
      weightTrackingEnabledByDefault: false,
      disclaimer: MEDICAL_DISCLAIMER,
    });
    expect(view?.health.messages.map((m) => m.code)).toContain('mineur');
    expect(JSON.stringify(view?.health)).not.toMatch(/kcal/i);
    expect(view?.energyDetail.deficitApplied).toBe(false);
    expect(view?.energyDetail.waistToHeightRatio).toBeCloseTo(70 / 165);
  });

  it('prévisualise un profil en cours de saisie', () => {
    const { uc } = setup();
    expect(uc.previewProfile(makeProfile({ householdSize: 0 })).health).toBeUndefined();
    const ok = uc.previewProfile(makeProfile({ goal: 'perdre-en-douceur' }));
    expect(ok.issues).toEqual([]);
    expect(ok.health?.lossAllowed).toBe(true);
  });
});
