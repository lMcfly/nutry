import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, TEST_PROFILE } from '../../testing/renderApp';

describe('carte quiz', () => {
  it('s’affiche une fois par session, puis se ferme et ne revient pas', async () => {
    const { user, ports } = renderApp({ profile: TEST_PROFILE, quiz: true });
    const dialog = await screen.findByRole('dialog', { name: /La question du jour/ });
    const choices = within(dialog)
      .getAllByRole('button')
      .filter((b) => /^[ABCD]/.test(b.textContent));
    expect(choices).toHaveLength(4);

    const question = ports.state.quiz.daily?.questionId;
    const correct = question === 'q-paris' ? /Paris/ : /100 °C/;
    await user.click(within(dialog).getByRole('button', { name: correct }));
    expect(await within(dialog).findByText('✓ Bonne réponse')).toBeInTheDocument();
    expect(within(dialog).getByText(/Série : 1 bonne réponse/)).toBeInTheDocument();
    expect(ports.state.quiz.streak).toBe(1);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    // Changement d'onglet : pas de nouvelle carte.
    await user.click(screen.getByRole('link', { name: 'Courses' }));
    await screen.findByRole('heading', { name: 'Mes courses' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('montre le résultat si la question a déjà été répondue aujourd’hui', async () => {
    renderApp({
      profile: TEST_PROFILE,
      quiz: true,
      quizState: {
        seenIds: ['q-paris'],
        streak: 0,
        bestStreak: 2,
        daily: { date: '2026-11-23', questionId: 'q-paris', answerIndex: 0 },
      },
    });
    const dialog = await screen.findByRole('dialog', { name: /La question du jour/ });
    expect(within(dialog).getByText(/Ta réponse/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Paris/ })).toHaveTextContent(
      /Bonne réponse/,
    );
    expect(within(dialog).getByText(/capitale de la France depuis/)).toBeInTheDocument();
    expect(within(dialog).getByText(/record : 2/)).toBeInTheDocument();
  });

  it('n’apparaît pas si la banque est vide', async () => {
    renderApp({ profile: TEST_PROFILE, quiz: true, questions: [] });
    await screen.findByRole('heading', { name: 'Ma semaine' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
