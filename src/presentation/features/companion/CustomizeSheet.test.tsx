import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INITIAL_COMPANION_STATE } from '@domain/companion';
import { ProfilePage } from '../../pages/ProfilePage';
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
  it('aperçu vivant, onglets Couleur / Yeux / Accessoires', async () => {
    const { user } = renderScreen(<ProfilePage />, { existing: setup(10) });
    const sheet = await openCustomizer(user);
    expect(
      within(sheet)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Couleur', 'Yeux', 'Accessoires']);
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
    // « Aucun » retire l'accessoire de l'emplacement.
    const head = within(sheet).getByRole('region', { name: 'Tête' });
    await user.click(within(head).getByRole('button', { name: /Aucun/ }));
    expect(preview()).toHaveAccessibleName(/sans accessoire/);
  });

  it('éléments verrouillés grisés avec cadenas et « à N jours de série »', async () => {
    const { user } = renderScreen(<ProfilePage />, { existing: setup(3) });
    const sheet = await openCustomizer(user);
    await user.click(within(sheet).getByRole('tab', { name: 'Accessoires' }));
    const toque = within(sheet).getByRole('button', { name: /Toque de chef/ });
    expect(toque).toHaveAttribute('aria-disabled', 'true');
    expect(toque.querySelector('svg')).not.toBeNull();
    expect(toque).toHaveTextContent('à 7 jours de série');
    const glasses = within(sheet).getByRole('button', { name: /Lunettes rondes/ });
    expect(glasses).toHaveAttribute('aria-disabled', 'false');

    // Cliquer un élément verrouillé ne change rien.
    await user.click(toque);
    expect(within(sheet).getByRole('img')).toHaveAccessibleName(/sans accessoire/);

    await user.click(within(sheet).getByRole('tab', { name: 'Couleur' }));
    expect(within(sheet).getByRole('button', { name: /Cosmos/ })).toHaveTextContent(
      'à 15 jours de série',
    );
  });

  it('enregistre avec customizeCompanion et met à jour Nutry', async () => {
    const existing = setup(10);
    const { user } = renderScreen(<ProfilePage />, { existing });
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
    const { user } = renderScreen(<ProfilePage />, {
      existing: { ports: existing.ports, useCases: refusing },
    });
    const sheet = await openCustomizer(user);
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer ce look' }));
    expect(await screen.findByText(/pas encore débloqué/)).toBeInTheDocument();
  });
});
