import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { INITIAL_COMPANION_STATE } from '@domain/companion';
import { CelebrationProvider, useCelebrationCheck } from './Celebration';
import celebrationCss from './Celebration.module.css?raw';
import { createTestUseCases, renderScreen } from '../../testing/renderApp';
import { TEST_PROFILE } from '../../testing/renderApp';

function Gesture() {
  const check = useCelebrationCheck();
  return (
    <button type="button" onClick={check}>
      geste
    </button>
  );
}

function setup(best: number, acknowledgedBest = 0) {
  const existing = createTestUseCases({ profile: TEST_PROFILE });
  existing.ports.state.companion = {
    ...INITIAL_COMPANION_STATE,
    streak: best,
    best,
    acknowledgedBest,
    lastActiveDay: '2026-11-23',
  };
  return existing;
}

describe('<CelebrationProvider />', () => {
  it('rien de nouveau : aucune modale', async () => {
    const existing = setup(0);
    renderScreen(
      <CelebrationProvider>
        <Gesture />
      </CelebrationProvider>,
      { existing },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('à l’ouverture : « Nutry a gagné … ! », puis acquittement', async () => {
    const existing = setup(7);
    const { user } = renderScreen(
      <CelebrationProvider>
        <Gesture />
      </CelebrationProvider>,
      { existing },
    );
    const dialog = await screen.findByRole('dialog', { name: 'Bravo !' });
    // Tout ce que le record de 7 jours débloque, y compris la teinte Aurore (5 jours).
    const text = within(dialog).getByText(/^Nutry a gagné /).textContent;
    for (const won of [
      'la feuille sur la tête',
      'les lunettes rondes',
      'la teinte Aurore',
      'la toque de chef',
    ]) {
      expect(text).toContain(won);
    }
    expect(text).toMatch(/ et .+ !$/);
    expect(within(dialog).getByRole('img', { name: /^Nutry, la petite boule/ })).toBeVisible();

    await user.click(within(dialog).getByRole('button', { name: 'Génial !' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(existing.ports.state.companion.acknowledgedBest).toBe(7);
    });
  });

  it('après un geste : la célébration s’ouvre quand un déblocage arrive', async () => {
    const existing = setup(0);
    const { user } = renderScreen(
      <CelebrationProvider>
        <Gesture />
      </CelebrationProvider>,
      { existing },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole('dialog')).toBeNull();

    // Un geste fait gagner la série de 1 jour : la feuille.
    existing.ports.state.companion = { ...existing.ports.state.companion, streak: 1, best: 1 };
    await user.click(screen.getByRole('button', { name: 'geste' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bravo !' });
    expect(within(dialog).getByText(/Nutry a gagné la feuille sur la tête !/)).toBeVisible();
    // Echap acquitte aussi.
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(existing.ports.state.companion.acknowledgedBest).toBe(1);
    });
  });

  it('une seule modale à la fois, même si plusieurs gestes se suivent', async () => {
    const existing = setup(3);
    const { user } = renderScreen(
      <CelebrationProvider>
        <Gesture />
      </CelebrationProvider>,
      { existing },
    );
    await screen.findByRole('dialog', { name: 'Bravo !' });
    // Le geste ne peut pas être cliqué (arrière-plan inerte) : on le déclenche directement.
    screen.getByRole('button', { name: 'geste', hidden: true }).click();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await user.keyboard('{Escape}');
  });

  it('les confettis sont décoratifs et coupés si le mouvement est réduit', () => {
    expect(celebrationCss).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*display: none/);
  });
});
