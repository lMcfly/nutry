import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { defaultTrainingInput } from '@domain/training';
import { makeProfile } from '@domain/testing/fixtures';
import { MePage } from '../../pages/MePage';
import { createTestUseCases, renderScreen } from '../../testing/renderApp';

/** Profil « sédentaire » et programme de 5 séances d'une heure : 300 min par semaine. */
async function setup(frequency: 1 | 5 = 5) {
  const existing = createTestUseCases({
    profile: makeProfile({ activity: 'sedentaire' }),
  });
  const saved = await existing.useCases.saveTrainingProfile({
    ...defaultTrainingInput(),
    frequency,
    days: frequency === 5 ? [0, 1, 2, 3, 4] : [0],
    sessionMinutes: frequency === 5 ? 60 : 20,
  });
  expect(saved.status).toBe('saved');
  return existing;
}

describe('carte « niveau d’activité » (Moi)', () => {
  it('propose le niveau suivant, sans rien changer tant qu’on ne confirme pas', async () => {
    const existing = await setup();
    const { user } = renderScreen(<MePage />, { existing });
    const card = await screen.findByRole('region', { name: 'Niveau d’activité' });
    // Une ligne discrète ; l'explication est dans la fenêtre qu'elle ouvre.
    expect(card).toHaveTextContent('pourrait monter d’un cran');
    await user.click(within(card).getByRole('button', { name: /pourrait monter d’un cran/ }));
    const dialog = await screen.findByRole('dialog', { name: /pourrait monter d’un cran/ });
    expect(dialog).toHaveTextContent('300 min de sport par semaine');
    expect(dialog).toHaveTextContent('« sédentaire » pourrait passer à « un peu actif »');
    expect(dialog).not.toHaveTextContent(/kcal|calorie|dépense|mérit/i);
    expect(existing.ports.state.profile?.activity).toBe('sedentaire');
  });

  it('« Oui, mettre à jour » relève d’un cran, confirme et masque la carte', async () => {
    const existing = await setup();
    const { user } = renderScreen(<MePage />, { existing });
    const card = await screen.findByRole('region', { name: 'Niveau d’activité' });
    await user.click(within(card).getByRole('button', { name: /pourrait monter/ }));
    const dialog = await screen.findByRole('dialog', { name: /pourrait monter/ });
    await user.click(within(dialog).getByRole('button', { name: 'Oui, mettre à jour' }));
    expect(await screen.findByText(/ton niveau d’activité est mis à jour/)).toBeInTheDocument();
    await waitFor(() => {
      expect(existing.ports.state.profile?.activity).toBe('leger');
    });
    expect(screen.queryByRole('region', { name: 'Niveau d’activité' })).toBeNull();
  });

  it('« Non merci » la refuse : rien ne change et le refus est retenu', async () => {
    const existing = await setup();
    const { user } = renderScreen(<MePage />, { existing });
    const card = await screen.findByRole('region', { name: 'Niveau d’activité' });
    await user.click(within(card).getByRole('button', { name: /pourrait monter/ }));
    const dialog = await screen.findByRole('dialog', { name: /pourrait monter/ });
    await user.click(within(dialog).getByRole('button', { name: 'Non merci' }));
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Niveau d’activité' })).toBeNull();
    });
    expect(existing.ports.state.profile?.activity).toBe('sedentaire');
    expect(existing.ports.state.settings.activitySuggestionDismissedOn).toBeDefined();
  });

  it('rien à proposer pour un petit volume ou sans Sport', async () => {
    renderScreen(<MePage />, { existing: await setup(1) });
    expect(await screen.findByRole('button', { name: 'Personnaliser Nutry' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Niveau d’activité' })).toBeNull();
  });
});
