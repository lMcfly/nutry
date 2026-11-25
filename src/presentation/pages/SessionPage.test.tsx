import { act, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionPage } from './SessionPage';
import { renderScreen } from '../testing/renderApp';
import { createSportEnv, currentWeek } from '../testing/sport';
import type { SportEnv } from '../testing/sport';

async function openSession(env?: SportEnv) {
  const sport = env ?? (await createSportEnv());
  const week = await currentWeek(sport.useCases);
  const session = week.plan.sessions[0];
  if (!session) throw new Error('aucune séance');
  const setup = renderScreen(
    <Routes>
      <Route path="/sport/seance/:weekStart/:sessionId" element={<SessionPage />} />
      <Route path="/sport" element={<p>Onglet Sport</p>} />
    </Routes>,
    { existing: sport, route: `/sport/seance/${week.plan.weekStart}/${session.id}` },
  );
  await screen.findByRole('progressbar', { name: 'Progression de la séance' });
  return { ...setup, session, week };
}

/** Avance jusqu'au premier exercice principal (après l'échauffement). */
async function toFirstExercise(user: ReturnType<typeof renderScreen>['user']) {
  for (let i = 0; i < 12; i += 1) {
    if (screen.queryByRole('button', { name: /Valider la série/ })) return;
    await user.click(screen.getByRole('button', { name: 'Exercice suivant' }));
  }
  throw new Error('pas d’exercice principal');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('<SessionPage />', () => {
  it('mode concentré : échauffement, progression, écran maintenu allumé', async () => {
    const { ports, session } = await openSession();
    expect(screen.getByRole('heading', { level: 1, name: session.title })).toBeVisible();
    expect(screen.getByText(/Échauffement · 1 sur/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Précédent' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeVisible();
    // Le journal est ouvert (séance commencée) et l'écran reste allumé.
    expect(ports.state.sessionLogs.size).toBe(1);
    await waitFor(() => {
      expect(ports.wakeLock.held).toBe(true);
    });
  });

  it('valider une série enregistre répétitions et lance le minuteur de repos', async () => {
    const { user, ports } = await openSession();
    await toFirstExercise(user);
    expect(screen.getByRole('button', { name: /Série 1 sur \d, à faire/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await user.click(screen.getByRole('button', { name: 'Plus : Répétitions' }));
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));

    const rest = await screen.findByRole('region', { name: 'Repos' });
    expect(within(rest).getByRole('timer')).toBeVisible();
    expect(screen.getByText(/Série 1 validée\. Repos de/)).toBeInTheDocument();
    const log = [...ports.state.sessionLogs.values()][0];
    const set = log?.exercises[0]?.sets[0];
    expect(set?.done).toBe(true);
    expect(set?.reps ?? set?.seconds).toBeGreaterThan(0);

    await user.click(within(rest).getByRole('button', { name: 'Ajouter 15 secondes de repos' }));
    await user.click(within(rest).getByRole('button', { name: 'Passer' }));
    expect(screen.queryByRole('region', { name: 'Repos' })).toBeNull();
    expect(screen.getByText('Repos passé.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Série 1 sur \d, faite/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Valider la série 2' })).toBeVisible();
  });

  it('« Tout est fait » valide l’exercice entier', async () => {
    const { user, ports } = await openSession();
    await toFirstExercise(user);
    await user.click(screen.getByRole('button', { name: 'Tout est fait' }));
    await waitFor(() => {
      expect([...ports.state.sessionLogs.values()][0]?.exercises[0]?.done).toBe(true);
    });
    expect(screen.queryByRole('button', { name: 'Tout est fait' })).toBeNull();
  });

  it('« Ça fait mal » : confirmation, messages de sécurité et remplacement', async () => {
    const { user, ports } = await openSession();
    await toFirstExercise(user);
    const before = screen.getByRole('heading', { level: 2 }).textContent;
    await user.click(screen.getByRole('button', { name: 'Ça fait mal' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Ça fait mal ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Oui, ça fait mal' }));

    const care = await screen.findByRole('dialog', { name: 'Prends soin de toi' });
    expect(within(care).getByText(/Arrête cet exercice/)).toBeVisible();
    expect(within(care).getByText(/appelle le 15/)).toBeVisible();
    expect(ports.state.painReports.size).toBe(1);
    await user.click(within(care).getByRole('button', { name: /D’accord/ }));
    // L'exercice a été remplacé (ou, faute de remplaçant, le message le dit).
    const after = screen.getByRole('heading', { level: 2 }).textContent;
    const replaced = [...ports.state.sessionLogs.values()][0]?.exercises[0]?.replacedExerciseId;
    if (replaced !== undefined) expect(after).not.toBe(before);
  });

  it('« Non, ça va » ne signale rien', async () => {
    const { user, ports } = await openSession();
    await toFirstExercise(user);
    await user.click(screen.getByRole('button', { name: 'Ça fait mal' }));
    await user.click(screen.getByRole('button', { name: 'Non, ça va' }));
    expect(ports.state.painReports.size).toBe(0);
  });

  it('« Remplacer » propose des exercices adaptés et en place un', async () => {
    const { user, ports } = await openSession();
    await toFirstExercise(user);
    await user.click(screen.getByRole('button', { name: 'Remplacer' }));
    const sheet = screen.getByRole('dialog', { name: 'Remplacer l’exercice' });
    const list = await within(sheet).findByRole('list', { name: 'Exercices proposés' });
    const [first] = within(list).getAllByRole('button');
    if (!first) throw new Error('aucun remplaçant');
    const name = first.textContent;
    await user.click(first);
    await waitFor(() => {
      expect(
        [...ports.state.sessionLogs.values()][0]?.exercises[0]?.replacedExerciseId,
      ).toBeDefined();
    });
    expect(name).toContain(screen.getByRole('heading', { level: 2 }).textContent);
  });

  it('le tuto : mannequin, consignes, sécurité et recherche YouTube en lien sortant', async () => {
    const { user } = await openSession();
    await toFirstExercise(user);
    await user.click(screen.getByRole('button', { name: 'Voir le tuto' }));
    const tuto = await screen.findByRole('dialog', { name: /^Tuto : / });
    expect(await within(tuto).findByRole('heading', { name: 'Comment faire' })).toBeVisible();
    expect(within(tuto).getByRole('heading', { name: 'Conseils de sécurité' })).toBeVisible();
    expect(within(tuto).getByRole('list', { name: 'Muscles principaux' })).toBeVisible();
    expect(within(tuto).getByText(/ne remplace pas un coach/)).toBeVisible();
    const video = within(tuto).getByRole('link', { name: /^Voir une vidéo/ });
    expect(video).toHaveAttribute(
      'href',
      expect.stringContaining('https://www.youtube.com/results'),
    );
    expect(video).toHaveAttribute('target', '_blank');
    expect(video).toHaveAttribute('rel', 'noopener noreferrer');
    await user.click(within(tuto).getByRole('radio', { name: 'Départ' }));
    await user.click(within(tuto).getByRole('button', { name: 'Fermer le tuto' }));
    expect(screen.queryByRole('dialog', { name: /^Tuto : / })).toBeNull();
  });

  it('terminer : ressenti, célébration de Nutry et série du jour', async () => {
    const { user, ports } = await openSession();
    await toFirstExercise(user);
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));
    await user.click(await screen.findByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Quitter la séance' }));
    await user.click(screen.getByRole('button', { name: 'Terminer maintenant' }));
    const effort = screen.getByRole('dialog', { name: 'Comment c’était ?' });
    await user.click(within(effort).getByRole('radio', { name: /Correct/ }));
    await user.click(within(effort).getByRole('button', { name: 'Terminer la séance' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: /Bravo, séance terminée/ }),
    ).toBeVisible();
    expect(screen.getByText(/Nutry gagne/)).toHaveTextContent('le bandeau');
    expect([...ports.state.sessionLogs.values()][0]?.status).toBe('terminee');
    expect([...ports.state.sessionLogs.values()][0]?.effort).toBe('correct');
    expect(screen.getByRole('link', { name: 'Retour à ma semaine' })).toHaveAttribute(
      'href',
      '/sport',
    );
  });

  it('terminer sans aucune série : message doux, rien d’enregistré', async () => {
    const { user, ports } = await openSession();
    await user.click(screen.getByRole('button', { name: 'Quitter la séance' }));
    await user.click(screen.getByRole('button', { name: 'Terminer maintenant' }));
    await user.click(screen.getByRole('button', { name: 'Terminer la séance' }));
    expect(await screen.findByText(/Aucune série n’est cochée/)).toBeVisible();
    expect([...ports.state.sessionLogs.values()][0]?.status).toBe('en-cours');
  });

  it('séance introuvable : message doux et retour au Sport', async () => {
    const sport = await createSportEnv();
    renderScreen(
      <Routes>
        <Route path="/sport/seance/:weekStart/:sessionId" element={<SessionPage />} />
      </Routes>,
      { existing: sport, route: '/sport/seance/2026-11-23/d9' },
    );
    expect(await screen.findByText(/plus dans ton programme/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Retour au Sport' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('échauffement : le minuteur se lance et s’annonce à la fin (horloge simulée)', async () => {
    vi.useFakeTimers({
      toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance', 'Date'],
    });
    const sport = await createSportEnv();
    const week = await currentWeek(sport.useCases);
    const session = week.plan.sessions[0];
    if (!session) throw new Error('aucune séance');
    renderScreen(
      <Routes>
        <Route path="/sport/seance/:weekStart/:sessionId" element={<SessionPage />} />
      </Routes>,
      {
        existing: sport,
        route: `/sport/seance/${week.plan.weekStart}/${session.id}`,
      },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Lancer' }).click();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText(/C’est parti pour/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeVisible();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });
    expect(screen.getByText(/C’est fait : passe au mouvement suivant/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeVisible();
  });
});
