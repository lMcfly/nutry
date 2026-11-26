import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INITIAL_COMPANION_STATE } from '@domain/companion';
import { MePage } from '../../pages/MePage';
import { TEST_PROFILE, createTestUseCases, renderScreen } from '../../testing/renderApp';

function setup(best: number) {
  const existing = createTestUseCases({ profile: TEST_PROFILE });
  existing.ports.state.companion = {
    ...INITIAL_COMPANION_STATE,
    streak: best,
    best,
    acknowledgedBest: best,
    lastActiveDay: '2026-11-23',
  };
  return existing;
}

async function openCustomizer(user: ReturnType<typeof renderScreen>['user']) {
  await user.click(await screen.findByRole('button', { name: /Personnaliser/ }));
  return screen.findByRole('dialog', { name: 'Personnaliser Nutry' });
}

describe('Personnaliser Nutry', () => {
  it('aperçu vivant, onglets Couleur / Yeux / Accessoires / Sport', async () => {
    const { user } = renderScreen(<MePage />, { existing: setup(10) });
    const sheet = await openCustomizer(user);
    expect(
      within(sheet)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Couleur', 'Yeux', 'Accessoires', 'Sport']);
    const preview = () => within(sheet).getByRole('img');
    expect(preview()).toHaveAccessibleName(/couleur menthe, yeux ronds, sans accessoire/);

    await user.click(within(sheet).getByRole('button', { name: /Abricot/ }));
    expect(preview()).toHaveAccessibleName(/couleur abricot/);

    await user.click(within(sheet).getByRole('tab', { name: 'Yeux' }));
    await user.click(within(sheet).getByRole('button', { name: /Rieurs/ }));
    expect(preview()).toHaveAccessibleName(/yeux rieurs/);

    await user.click(within(sheet).getByRole('tab', { name: 'Accessoires' }));
    await user.click(within(sheet).getByRole('button', { name: /Toque de chef/ }));
    expect(preview()).toHaveAccessibleName(/avec toque de chef/);
    // Un seul accessoire par emplacement : le bonnet est encore verrouillé (21 jours).
    await user.click(within(sheet).getByRole('button', { name: /Feuille sur la tête/ }));
    expect(preview()).toHaveAccessibleName(/avec feuille sur la tête/);
    expect(preview().getAttribute('aria-label')).not.toContain('toque');
    // Retoucher l'accessoire porté l'enlève ; « Aucun accessoire » retire tout.
    await user.click(within(sheet).getByRole('button', { name: /Feuille sur la tête/ }));
    expect(preview()).toHaveAccessibleName(/sans accessoire/);
    await user.click(within(sheet).getByRole('button', { name: /Écharpe/ }));
    expect(preview()).toHaveAccessibleName(/avec écharpe/);
    await user.click(within(sheet).getByRole('button', { name: 'Aucun accessoire' }));
    expect(preview()).toHaveAccessibleName(/sans accessoire/);
  });

  it('éléments verrouillés grisés avec cadenas et « à N jours de série »', async () => {
    const { user } = renderScreen(<MePage />, { existing: setup(3) });
    const sheet = await openCustomizer(user);
    await user.click(within(sheet).getByRole('tab', { name: 'Accessoires' }));
    const toque = within(sheet).getByRole('button', { name: /Toque de chef/ });
    expect(toque).toHaveAttribute('aria-disabled', 'true');
    expect(toque.querySelector('svg')).not.toBeNull();
    expect(toque).toHaveAccessibleName(/verrouillé, à 7 jours de série/);
    expect(toque).toHaveTextContent('à 7 jours');
    const glasses = within(sheet).getByRole('button', { name: /Lunettes rondes/ });
    expect(glasses).toHaveAttribute('aria-disabled', 'false');

    // Cliquer un élément verrouillé ne change rien.
    await user.click(toque);
    expect(within(sheet).getByRole('img')).toHaveAccessibleName(/sans accessoire/);

    await user.click(within(sheet).getByRole('tab', { name: 'Couleur' }));
    expect(within(sheet).getByRole('button', { name: /Cosmos/ })).toHaveTextContent('à 15 jours');
  });

  it('accessoires de sport : verrouillés « à N séances », débloqués par les séances terminées', async () => {
    const existing = setup(0);
    const done = (n: number) => ({
      id: `log-${n}`,
      weekStart: '2026-11-23',
      sessionId: `s-${n}`,
      date: '2026-11-23',
      status: 'terminee' as const,
      startedAt: '2026-11-23T08:00:00.000Z',
      completedAt: '2026-11-23T08:40:00.000Z',
      exercises: [],
    });
    for (let n = 0; n < 5; n += 1) existing.ports.state.sessionLogs.set(`log-${n}`, done(n));
    const { user } = renderScreen(<MePage />, { existing });
    const sheet = await openCustomizer(user);
    await user.click(within(sheet).getByRole('tab', { name: 'Sport' }));
    const towel = within(sheet).getByRole('button', { name: /Serviette/ });
    expect(towel).toHaveAttribute('aria-disabled', 'false');
    const cap = within(sheet).getByRole('button', { name: /Casquette/ });
    expect(cap).toHaveAttribute('aria-disabled', 'true');
    expect(cap).toHaveAccessibleName(/verrouillé, à 10 séances/);
    expect(cap).toHaveTextContent('à 10 séances');
    expect(within(sheet).getByRole('button', { name: /Médaille/ })).toHaveTextContent(
      'à 20 séances',
    );
    await user.click(within(sheet).getByRole('button', { name: /Bandeau/ }));
    await user.click(towel);
    expect(within(sheet).getByRole('img')).toHaveAccessibleName(/avec bandeau, serviette/);
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer ce look' }));
    await waitFor(() => {
      expect(existing.ports.state.companion.look.accessories).toEqual({
        tete: 'bandeau',
        cou: 'serviette',
      });
    });
  });

  it('enregistre avec customizeCompanion et met à jour Nutry', async () => {
    const existing = setup(10);
    const { user } = renderScreen(<MePage />, { existing });
    const sheet = await openCustomizer(user);
    await user.click(within(sheet).getByRole('button', { name: /Framboise/ }));
    await user.click(within(sheet).getByRole('tab', { name: 'Accessoires' }));
    await user.click(within(sheet).getByRole('button', { name: /Écharpe/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer ce look' }));
    expect(await screen.findByText('Nutry a changé de look !')).toBeInTheDocument();
    await waitFor(() => {
      expect(existing.ports.state.companion.look).toMatchObject({
        color: 'framboise',
        accessories: { cou: 'echarpe' },
      });
    });
    expect(screen.queryByRole('dialog', { name: 'Personnaliser Nutry' })).toBeNull();
    expect(await screen.findByRole('img', { name: /couleur framboise.*écharpe/ })).toBeVisible();
  });

  it('un refus du cas d’usage affiche son message doux', async () => {
    const existing = setup(10);
    const refusing = {
      ...existing.useCases,
      customizeCompanion: () =>
        Promise.resolve({
          status: 'refused' as const,
          reason: 'locked' as const,
          message: 'Cet élément n’est pas encore débloqué, mais ça viendra !',
        }),
    };
    const { user } = renderScreen(<MePage />, {
      existing: { ports: existing.ports, useCases: refusing },
    });
    const sheet = await openCustomizer(user);
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer ce look' }));
    expect(await screen.findByText(/pas encore débloqué/)).toBeInTheDocument();
  });
});
