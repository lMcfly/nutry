import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SportPage } from './SportPage';
import { renderScreen } from '../testing/renderApp';
import { createSportEnv } from '../testing/sport';
import type { SportEnv } from '../testing/sport';
import { makeProfile } from '@domain/testing/fixtures';

function render(env: SportEnv) {
  return renderScreen(
    <Routes>
      <Route path="/sport" element={<SportPage />} />
      <Route path="/sport/bienvenue" element={<h1>Bienvenue Sport</h1>} />
      <Route path="/sport/seance/:weekStart/:sessionId" element={<h1>Séance ouverte</h1>} />
      <Route path="/semaine" element={<h1>Ma semaine</h1>} />
    </Routes>,
    { existing: env, route: '/sport' },
  );
}

describe('<SportPage />', () => {
  it('premier passage : Nutry propose, sans imposer', async () => {
    const { user } = render(await createSportEnv({ training: false }));
    expect(
      await screen.findByRole('heading', { name: /Envie de bouger avec Nutry/ }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Oui, on essaie' })).toHaveAttribute(
      'href',
      '/sport/bienvenue',
    );
    expect(screen.getByRole('note')).toHaveTextContent('ne remplace pas un coach');
    await user.click(screen.getByRole('button', { name: 'Pas maintenant' }));
    expect(await screen.findByRole('heading', { name: 'Ma semaine' })).toBeVisible();
  });

  it('la semaine : séance du jour mise en avant, jours de séance et de repos repérés', async () => {
    const { user } = render(await createSportEnv());
    const card = await screen.findByTestId('sport-session');
    expect(within(card).getByText('Aujourd’hui')).toBeVisible();
    expect(within(card).getByText(/environ \d+ min · \d+ exercices/)).toBeVisible();
    expect(within(card).getByRole('list', { name: 'Muscles travaillés' })).toBeVisible();
    expect(within(card).getByRole('list', { name: 'Aperçu des exercices' })).toBeVisible();
    expect(screen.getByText('Semaine 1 sur 6')).toBeVisible();
    expect(screen.getByText('0 séance sur 3')).toBeVisible();
    expect(screen.getByRole('note')).toHaveTextContent('ne remplace pas un coach');

    const tabs = screen.getByRole('tablist', { name: 'Jours de la semaine d’entraînement' });
    const tuesday = within(tabs).getByRole('tab', { name: /^Mardi 24 novembre, repos/ });
    await user.click(tuesday);
    expect(screen.getByRole('heading', { name: 'Jour de repos' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Prochaine séance : mercredi/ }));
    expect(within(tabs).getByRole('tab', { selected: true })).toHaveAccessibleName(
      /^Mercredi 25 novembre/,
    );

    await user.click(within(tabs).getByRole('tab', { name: /^Lundi 23 novembre, aujourd’hui/ }));
    await user.click(screen.getByRole('button', { name: 'Commencer la séance' }));
    expect(await screen.findByRole('heading', { name: 'Séance ouverte' })).toBeVisible();
  });

  it('garde-fou à lire : « J’ai compris » avant la première séance', async () => {
    const env = await createSportEnv({
      acknowledged: false,
      profile: makeProfile({ healthCondition: true }),
    });
    const { user, ports } = render(env);
    await user.click(await screen.findByRole('button', { name: 'Commencer la séance' }));
    const dialog = screen.getByRole('dialog', { name: 'Avant de commencer' });
    expect(within(dialog).getByText(/parles-en à ton médecin/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'J’ai compris' }));
    expect(await screen.findByRole('heading', { name: 'Séance ouverte' })).toBeVisible();
    expect(ports.state.training?.safetyAcknowledgedOn).toBe('2026-11-23');
  });

  it('menu : programme modifiable, historique et crédits', async () => {
    const { user, ports } = render(await createSportEnv());
    await user.click(await screen.findByRole('button', { name: 'Plus d’options' }));
    const menu = screen.getByRole('dialog', { name: 'Mon sport' });
    expect(within(menu).getByRole('link', { name: /Crédits exercices/ })).toHaveAttribute(
      'href',
      '/credits-exercices',
    );
    await user.click(within(menu).getByRole('button', { name: /Mon programme/ }));
    const settings = await screen.findByRole('dialog', { name: 'Mon programme sportif' });
    const durations = await within(settings).findByRole('group', { name: 'Durée d’une séance' });
    await user.click(within(durations).getByRole('radio', { name: /45 min/ }));
    await user.click(within(settings).getByRole('button', { name: 'Enregistrer mon programme' }));
    await waitFor(() => {
      expect(ports.state.training?.sessionMinutes).toBe(45);
    });

    await user.click(screen.getByRole('button', { name: 'Mes séances' }));
    const history = await screen.findByRole('dialog', { name: 'Mes séances' });
    expect(await within(history).findByText(/Pas encore de séance/)).toBeVisible();
    expect(within(history).getByText(/pour le bandeau de Nutry/)).toBeVisible();
  });

  it('échec du chargement : message doux et « Réessayer »', async () => {
    const env = await createSportEnv();
    env.ports.exercises.getExercises = () => Promise.reject(new Error('hors ligne'));
    render(env);
    expect(await screen.findByText('Le Sport fait une petite pause')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  });
});
