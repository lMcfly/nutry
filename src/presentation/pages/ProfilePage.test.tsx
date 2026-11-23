import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MEDICAL_DISCLAIMER } from '@domain/profile';
import { ProfilePage, SAVE_FAILED_MESSAGE } from './ProfilePage';
import { TEST_PROFILE, createTestUseCases, renderScreen } from '../testing/renderApp';

describe('<ProfilePage />', () => {
  it('affiche le bandeau médical, modifie et enregistre les réponses', async () => {
    const { user, ports } = renderScreen(<ProfilePage />);
    expect(await screen.findByText(MEDICAL_DISCLAIMER)).toBeVisible();
    const save = screen.getByRole('button', { name: /Réponses enregistrées/ });
    expect(save).toBeDisabled();

    await user.click(screen.getByText(/Goûts/, { selector: 'summary' }));
    const dislikes = screen.getByRole('group', { name: /Je n’aime pas/ });
    await user.click(within(dislikes).getByRole('checkbox', { name: /Champignons/ }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer mes réponses' }));
    expect(await screen.findByText(/C’est enregistré/)).toBeInTheDocument();
    expect(ports.state.profile?.dislikes).toEqual(['champignons']);
  });

  it('change le thème sur <html data-theme>', async () => {
    const { user, ports } = renderScreen(<ProfilePage />);
    await user.click(await screen.findByRole('radio', { name: 'Sombre' }));
    expect(document.documentElement.dataset['theme']).toBe('dark');
    await waitFor(() => {
      expect(ports.state.settings.theme).toBe('dark');
    });
  });

  it('profil protégé : messages bienveillants et perte grisée', async () => {
    const { user } = renderScreen(<ProfilePage />, {
      profile: { ...TEST_PROFILE, healthCondition: true },
    });
    const messages = await screen.findAllByText(
      /condition de santé particulière, ton alimentation/,
    );
    expect(messages[0]).toBeVisible();
    await user.click(screen.getByText(/Objectif, régime/, { selector: 'summary' }));
    expect(screen.getByRole('radio', { name: /Perdre en douceur/ })).toBeDisabled();
  });

  it('montre le détail énergétique seulement sur demande', async () => {
    renderScreen(<ProfilePage />);
    const summary = await screen.findByText(/Mon détail énergétique/);
    const details = summary.closest('details');
    expect(details).not.toHaveAttribute('open');
    expect(within(details as HTMLElement).getByText('IMC')).toBeInTheDocument();
  });

  it('chargement : bandeau médical déjà là, place réservée, pas encore de « Mes données »', () => {
    const { ports, useCases } = createTestUseCases({ profile: TEST_PROFILE });
    const pending = { ...useCases, getProfile: () => new Promise<never>(() => undefined) };
    renderScreen(<ProfilePage />, { existing: { ports, useCases: pending } });
    expect(screen.getByText(MEDICAL_DISCLAIMER)).toBeVisible();
    expect(screen.getByTestId('profile-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Mes données/ })).toBeNull();
  });

  it('erreur de chargement : bandeau médical, message doux et « Mes données »', async () => {
    const { ports, useCases } = createTestUseCases({ profile: TEST_PROFILE });
    const failing = { ...useCases, getProfile: () => Promise.reject(new Error('base')) };
    renderScreen(<ProfilePage />, { existing: { ports, useCases: failing } });
    expect(await screen.findByText(/Ton profil n’a pas pu être chargé/)).toBeVisible();
    expect(screen.getByText(MEDICAL_DISCLAIMER)).toBeVisible();
    expect(screen.getByRole('heading', { name: /Mes données/ })).toBeVisible();
    expect(screen.queryByTestId('profile-skeleton')).toBeNull();
  });

  it('un enregistrement raté affiche un message, sans planter', async () => {
    const { ports, useCases } = createTestUseCases({ profile: TEST_PROFILE });
    const failing = { ...useCases, saveProfile: () => Promise.reject(new Error('quota')) };
    const { user } = renderScreen(<ProfilePage />, { existing: { ports, useCases: failing } });
    await user.click(await screen.findByText(/Goûts/, { selector: 'summary' }));
    const dislikes = screen.getByRole('group', { name: /Je n’aime pas/ });
    await user.click(within(dislikes).getByRole('checkbox', { name: /Champignons/ }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer mes réponses' }));
    expect(await screen.findByText(SAVE_FAILED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer mes réponses' })).toBeEnabled();
  });

  it('l’objectif retenu par l’application remplace « perdre » pour un profil protégé', async () => {
    const { user, ports } = renderScreen(<ProfilePage />, {
      profile: { ...TEST_PROFILE, age: 16, goal: 'perdre-en-douceur' },
    });
    await user.click(await screen.findByText(/Goûts/, { selector: 'summary' }));
    const dislikes = screen.getByRole('group', { name: /Je n’aime pas/ });
    await user.click(within(dislikes).getByRole('checkbox', { name: /Champignons/ }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer mes réponses' }));
    await waitFor(() => {
      expect(ports.state.profile?.goal).toBe('reequilibrer');
    });
    await user.click(screen.getByText(/Objectif, régime/, { selector: 'summary' }));
    expect(screen.getByRole('radio', { name: /Rééquilibrer/ })).toBeChecked();
  });
});
