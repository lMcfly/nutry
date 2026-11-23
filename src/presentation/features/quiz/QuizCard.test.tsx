import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp, TEST_PROFILE } from '../../testing/renderApp';

const CORRECT = { 'q-paris': /Paris/, 'q-eau': /100 °C/ } as const;
const WRONG = { 'q-paris': /Lyon/, 'q-eau': /50 °C/ } as const;

describe('carte quiz', () => {
  it('s’affiche une fois par ouverture, puis se ferme et ne revient pas', async () => {
    const { user, ports } = renderApp({ profile: TEST_PROFILE, quiz: true });
    const dialog = await screen.findByRole('dialog', { name: /La question du moment/ });
    const choices = within(dialog)
      .getAllByRole('button')
      .filter((b) => /^[ABCD]/.test(b.textContent));
    expect(choices).toHaveLength(4);

    const question = ports.state.quiz.current?.questionId === 'q-paris' ? 'q-paris' : 'q-eau';
    await user.click(within(dialog).getByRole('button', { name: CORRECT[question] }));
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

  it('même ouverture (carte rouverte) : même question et son résultat', async () => {
    renderApp({
      profile: TEST_PROFILE,
      quiz: true,
      quizSessionId: 's-ouverture',
      quizState: {
        seenIds: ['q-paris'],
        streak: 0,
        bestStreak: 2,
        current: { sessionId: 's-ouverture', questionId: 'q-paris', answerIndex: 0 },
      },
    });
    const dialog = await screen.findByRole('dialog', { name: /La question du moment/ });
    expect(within(dialog).getByText(/Ta réponse/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Paris/ })).toHaveTextContent(
      /Bonne réponse/,
    );
    expect(within(dialog).getByText(/capitale de la France depuis/)).toBeInTheDocument();
    expect(within(dialog).getByText(/record : 2/)).toBeInTheDocument();
    expect(
      within(dialog).getByText('Nouvelle série à la prochaine question !'),
    ).toBeInTheDocument();
  });

  it('nouvelle ouverture : nouvelle question, sans le résultat précédent', async () => {
    renderApp({
      profile: TEST_PROFILE,
      quiz: true,
      quizState: {
        seenIds: ['q-paris'],
        streak: 3,
        bestStreak: 3,
        current: { sessionId: 's-hier', questionId: 'q-paris', answerIndex: 1 },
      },
    });
    const dialog = await screen.findByRole('dialog', { name: /La question du moment/ });
    expect(within(dialog).getByText(/température l’eau bout-elle/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Ta réponse|Bonne réponse/)).toBeNull();
  });

  it('mauvaise réponse : encouragement sans reproche et nouvelle série à la prochaine question', async () => {
    const { user, ports } = renderApp({
      profile: TEST_PROFILE,
      quiz: true,
      quizState: { seenIds: [], streak: 2, bestStreak: 2 },
    });
    const dialog = await screen.findByRole('dialog', { name: /La question du moment/ });
    const question = ports.state.quiz.current?.questionId === 'q-paris' ? 'q-paris' : 'q-eau';
    await user.click(within(dialog).getByRole('button', { name: WRONG[question] }));
    expect(
      await within(dialog).findByText(/Une autre question t’attend à ta prochaine visite/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText('Nouvelle série à la prochaine question !'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/record : 2/)).toBeInTheDocument();
    expect(ports.state.quiz.streak).toBe(0);
  });

  it('fermée sans réponse : la série reste intacte', async () => {
    const { user, ports } = renderApp({
      profile: TEST_PROFILE,
      quiz: true,
      quizState: { seenIds: [], streak: 2, bestStreak: 2 },
    });
    const dialog = await screen.findByRole('dialog', { name: /La question du moment/ });
    await user.click(within(dialog).getByRole('button', { name: 'Fermer la question du moment' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(ports.state.quiz.streak).toBe(2);
    expect(ports.state.quiz.seenIds).toEqual([]);
  });

  it('n’apparaît pas si la banque est vide', async () => {
    renderApp({ profile: TEST_PROFILE, quiz: true, questions: [] });
    await screen.findByRole('heading', { name: 'Ma semaine' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
