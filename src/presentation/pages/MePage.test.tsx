import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MEDICAL_DISCLAIMER } from '@domain/profile';
import { MePage, SAVE_FAILED_MESSAGE } from './MePage';
import { TEST_PROFILE, createTestUseCases, renderScreen } from '../testing/renderApp';

type User = ReturnType<typeof renderScreen>['user'];

/** Ouvre la feuille plein écran d'une tuile (Moi, Goûts, Apparence…). */
async function openTile(user: User, name: string | RegExp): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name: 'Réglages' }));
  const settings = await screen.findByRole('dialog', { name: 'Réglages' });
  await user.click(within(settings).getByRole('button', { name }));
  return screen.findByRole('dialog', { name });
}

describe('<MePage />', () => {
  it('Nutry en grand, tuiles, bandeau médical : modifie et enregistre les réponses', async () => {
    const { user, ports } = renderScreen(<MePage />);
    expect(await screen.findByText(MEDICAL_DISCLAIMER)).toBeVisible();
    expect(await screen.findByRole('img', { name: /^Nutry, la petite boule/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Personnaliser Nutry' })).toBeVisible();
    // Les réglages ne sont plus sur la page : ils s'ouvrent depuis le ⚙.
    expect(screen.queryByRole('button', { name: 'Goûts' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Réglages' }));
    const settings = await screen.findByRole('dialog', { name: 'Réglages' });
    for (const tile of [
      'Moi',
      'Objectif et alimentation',
      'Goûts',
      'Organisation',
      'Apparence et suivi',
      'Mes données',
      'Confidentialité',
    ]) {
      expect(within(settings).getByRole('button', { name: tile })).toBeVisible();
    }
    await user.click(within(settings).getByRole('button', { name: 'Fermer' }));

    const sheet = await openTile(user, 'Goûts');
    const save = within(sheet).getByRole('button', { name: /Réponses enregistrées/ });
    expect(save).toBeDisabled();
    const dislikes = within(sheet).getByRole('group', { name: /Je n’aime pas/ });
    await user.click(within(dislikes).getByRole('checkbox', { name: /Champignons/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer mes réponses' }));
    expect(await screen.findByText(/C’est enregistré/)).toBeInTheDocument();
    expect(ports.state.profile?.dislikes).toEqual(['champignons']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fermer une feuille sans enregistrer abandonne les changements', async () => {
    const { user, ports } = renderScreen(<MePage />);
    const sheet = await openTile(user, 'Goûts');
    await user.click(
      within(within(sheet).getByRole('group', { name: /Je n’aime pas/ })).getByRole('checkbox', {
        name: /Champignons/,
      }),
    );
    await user.click(within(sheet).getByRole('button', { name: 'Fermer' }));
    const again = await openTile(user, 'Goûts');
    expect(
      within(within(again).getByRole('group', { name: /Je n’aime pas/ })).getByRole('checkbox', {
        name: /Champignons/,
      }),
    ).not.toBeChecked();
    expect(ports.state.profile?.dislikes).toEqual([]);
  });

  it('Nutry : humeur, série et prochain déblocage', async () => {
    renderScreen(<MePage />);
    expect(await screen.findByRole('img', { name: /il est content/ })).toBeVisible();
    expect(screen.getByText(/Pas de série en cours/)).toBeVisible();
    expect(screen.getByText('Encore 1 jour pour la feuille sur la tête !')).toBeVisible();
  });

  it('change le thème sur <html data-theme>', async () => {
    const { user, ports } = renderScreen(<MePage />);
    const sheet = await openTile(user, 'Apparence et suivi');
    await user.click(within(sheet).getByRole('radio', { name: 'Sombre' }));
    expect(document.documentElement.dataset['theme']).toBe('dark');
    await waitFor(() => {
      expect(ports.state.settings.theme).toBe('dark');
    });
  });

  it('profil protégé : messages bienveillants et perte grisée', async () => {
    const { user } = renderScreen(<MePage />, {
      profile: { ...TEST_PROFILE, healthCondition: true },
    });
    const messages = await screen.findAllByText(
      /condition de santé particulière, ton alimentation/,
    );
    expect(messages[0]).toBeVisible();
    const sheet = await openTile(user, 'Objectif et alimentation');
    expect(within(sheet).getByRole('radio', { name: /Perdre en douceur/ })).toBeDisabled();
  });

  it('montre le détail énergétique seulement sur demande', async () => {
    const { user } = renderScreen(<MePage />);
    await openTile(user, 'Moi');
    const summary = await screen.findByText(/Mon détail énergétique/);
    const details = summary.closest('details');
    expect(details).not.toHaveAttribute('open');
    expect(within(details as HTMLElement).getByText('IMC')).toBeInTheDocument();
  });

  it('chargement : bandeau médical déjà là, place réservée, pas encore de « Mes données »', () => {
    const { ports, useCases } = createTestUseCases({ profile: TEST_PROFILE });
    const pending = { ...useCases, getProfile: () => new Promise<never>(() => undefined) };
    renderScreen(<MePage />, { existing: { ports, useCases: pending } });
    expect(screen.getByText(MEDICAL_DISCLAIMER)).toBeVisible();
    expect(screen.getByTestId('profile-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mes données' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Réglages' })).toBeVisible();
  });

  it('erreur de chargement : bandeau médical, message doux et « Mes données »', async () => {
    const { ports, useCases } = createTestUseCases({ profile: TEST_PROFILE });
    const failing = { ...useCases, getProfile: () => Promise.reject(new Error('base')) };
    const { user } = renderScreen(<MePage />, { existing: { ports, useCases: failing } });
    expect(await screen.findByText(/Ton profil n’a pas pu être chargé/)).toBeVisible();
    expect(screen.getByText(MEDICAL_DISCLAIMER)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Réglages' }));
    const settings = await screen.findByRole('dialog', { name: 'Réglages' });
    expect(within(settings).getByRole('button', { name: 'Mes données' })).toBeVisible();
    expect(within(settings).queryByRole('button', { name: 'Goûts' })).toBeNull();
    expect(screen.queryByTestId('profile-skeleton')).toBeNull();
  });

  it('un enregistrement raté affiche un message, sans planter', async () => {
    const { ports, useCases } = createTestUseCases({ profile: TEST_PROFILE });
    const failing = { ...useCases, saveProfile: () => Promise.reject(new Error('quota')) };
    const { user } = renderScreen(<MePage />, { existing: { ports, useCases: failing } });
    const sheet = await openTile(user, 'Goûts');
    const dislikes = within(sheet).getByRole('group', { name: /Je n’aime pas/ });
    await user.click(within(dislikes).getByRole('checkbox', { name: /Champignons/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer mes réponses' }));
    expect(await screen.findByText(SAVE_FAILED_MESSAGE)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Enregistrer mes réponses' })).toBeEnabled();
  });

  it('l’objectif retenu par l’application remplace « perdre » pour un profil protégé', async () => {
    const { user, ports } = renderScreen(<MePage />, {
      profile: { ...TEST_PROFILE, age: 16, goal: 'perdre-en-douceur' },
    });
    const tastes = await openTile(user, 'Goûts');
    const dislikes = within(tastes).getByRole('group', { name: /Je n’aime pas/ });
    await user.click(within(dislikes).getByRole('checkbox', { name: /Champignons/ }));
    await user.click(within(tastes).getByRole('button', { name: 'Enregistrer mes réponses' }));
    await waitFor(() => {
      expect(ports.state.profile?.goal).toBe('reequilibrer');
    });
    const goal = await openTile(user, 'Objectif et alimentation');
    expect(within(goal).getByRole('radio', { name: /Rééquilibrer/ })).toBeChecked();
  });
});
