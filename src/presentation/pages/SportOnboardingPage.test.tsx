import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SportOnboardingPage } from './SportOnboardingPage';
import { renderScreen } from '../testing/renderApp';
import { createSportEnv } from '../testing/sport';
import { makeProfile } from '@domain/testing/fixtures';

/** Les titres portent une espace fine insécable avant « ? ». */
const question = (name: string | RegExp) =>
  screen.findByRole('heading', {
    level: 1,
    name: typeof name === 'string' ? name.replace(' ?', '\u202f?') : name,
  });

async function render(env?: Awaited<ReturnType<typeof createSportEnv>>) {
  const sport = env ?? (await createSportEnv({ training: false }));
  return {
    ...renderScreen(
      <Routes>
        <Route path="/sport/bienvenue" element={<SportOnboardingPage />} />
        <Route path="/sport" element={<h1>Onglet Sport</h1>} />
      </Routes>,
      { existing: sport, route: '/sport/bienvenue' },
    ),
    sport,
  };
}

describe('<SportOnboardingPage />', () => {
  it('une question par écran, posée par Nutry, puis les garde-fous et « J’ai compris »', async () => {
    const { user, ports } = await render();
    await question(/Combien de fois par semaine/);
    expect(screen.getByRole('progressbar', { name: 'Progression' })).toHaveAttribute(
      'aria-valuemax',
      '7',
    );
    expect(screen.getByRole('img', { name: /^Nutry/ })).toBeVisible();

    // 4 séances : les jours sont préremplis (4), on en retire un, Continuer refuse avec douceur.
    await user.click(screen.getByRole('radio', { name: /4 fois/ }));
    await question('Quels jours te conviennent ?');
    expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(4);
    await user.click(screen.getByRole('checkbox', { name: 'Lundi' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choisis 4 jours (3 pour l’instant).');
    await user.click(screen.getByRole('checkbox', { name: 'Dimanche' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await question('Où t’entraînes-tu ?');
    await user.click(screen.getByRole('radio', { name: /En salle/ }));
    await user.click(screen.getByRole('button', { name: 'Ajuster mon matériel' }));
    const gear = screen.getByRole('group', { name: 'Mon matériel' });
    expect(within(gear).getByRole('checkbox', { name: /Machines guidées/ })).toBeChecked();
    await user.click(within(gear).getByRole('checkbox', { name: /Machines guidées/ }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await question('Quel est ton niveau ?');
    await user.click(screen.getByRole('radio', { name: /Intermédiaire/ }));
    await question('Quel est ton objectif ?');
    await user.click(screen.getByRole('radio', { name: /Me muscler/ }));
    await question('Combien de temps par séance ?');
    await user.click(screen.getByRole('radio', { name: /45 min/ }));
    await user.click(screen.getByRole('button', { name: 'Créer mon programme' }));

    await question(/sécurité/);
    expect(screen.getByRole('note')).toHaveTextContent(
      'Nutry ne remplace pas un coach ni un médecin.',
    );
    expect(ports.state.training).toMatchObject({
      frequency: 4,
      days: [1, 3, 4, 6],
      setting: 'salle',
      level: 'intermediaire',
      goal: 'muscle',
      sessionMinutes: 45,
    });
    expect(ports.state.training?.equipment).not.toContain('machine');
    await user.click(screen.getByRole('button', { name: 'J’ai compris' }));
    expect(await screen.findByRole('heading', { name: 'Onglet Sport' })).toBeVisible();
    expect(ports.state.training?.safetyAcknowledgedOn).toBe('2026-11-23');
  });

  it('retour : on revient à la question précédente, puis à l’onglet Sport', async () => {
    const { user } = await render();
    await question(/Combien de fois/);
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await question('Quels jours te conviennent ?');
    await user.click(screen.getByRole('button', { name: 'Retour' }));
    await question(/Combien de fois/);
    await user.click(screen.getByRole('button', { name: 'Retour au Sport' }));
    expect(await screen.findByRole('heading', { name: 'Onglet Sport' })).toBeVisible();
  });

  it('grossesse déclarée : l’étape est demandée, facultative, et la prudence s’affiche', async () => {
    const env = await createSportEnv({
      training: false,
      profile: makeProfile({ sex: 'femme', pregnantOrBreastfeeding: true }),
    });
    const { user, ports } = await render(env);
    await question(/Combien de fois/);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '8');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await question('Combien de temps par séance ?');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await question('Où en es-tu ?');
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await question(/sécurité/);
    expect(screen.getByText(/sage-femme/)).toBeVisible();
    await waitFor(() => {
      expect(ports.state.training?.pregnancyStage).toBeUndefined();
    });
    expect(ports.state.training).toBeDefined();
  });
});
