import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressPage } from './ProgressPage';
import { TEST_PROFILE, createTestUseCases, renderScreen } from '../testing/renderApp';

describe('<ProgressPage />', () => {
  it('saisie hebdomadaire, courbe accessible et suppression', async () => {
    const existing = createTestUseCases({ profile: TEST_PROFILE });
    existing.ports.state.progress.set('2026-11-09', { date: '2026-11-09', weightKg: 63 });
    existing.ports.state.progress.set('2026-11-16', { date: '2026-11-16', weightKg: 62.4 });
    const { user, ports } = renderScreen(<ProgressPage />, { existing });
    const weight = await screen.findByLabelText('Poids');
    await user.type(weight, '62,1');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText(/bravo pour ta régularité/)).toBeInTheDocument();
    expect(ports.state.progress.get('2026-11-23')?.weightKg).toBe(62.1);

    const chart = await screen.findByRole('img', { name: 'Poids, tendance lissée' });
    expect(chart).toHaveAccessibleDescription(/3 mesures/);
    expect(screen.getByRole('table', { hidden: true })).toBeInTheDocument();

    await user.click(screen.getByText(/Mes mesures/));
    await user.click(screen.getByRole('button', { name: /Supprimer la mesure du 9 novembre/ }));
    await waitFor(() => {
      expect(ports.state.progress.has('2026-11-09')).toBe(false);
    });
  });

  it('suivi du poids désactivé par défaut : formulation douce et activation', async () => {
    const { user, ports } = renderScreen(<ProgressPage />, {
      profile: { ...TEST_PROFILE, age: 16 },
    });
    const card = (await screen.findByRole('heading', { name: /Suivi du poids/ })).closest(
      'section',
    );
    expect(card).toHaveTextContent(/on préfère ne pas mettre l’accent sur le poids/);
    expect(screen.queryByLabelText('Poids')).toBeNull();
    expect(screen.getByLabelText('Tour de taille')).toBeInTheDocument();
    await user.click(
      within(card as HTMLElement).getByRole('button', { name: 'Activer le suivi du poids' }),
    );
    expect(await screen.findByLabelText('Poids')).toBeInTheDocument();
    expect(ports.state.settings.weightTracking).toBe(true);
  });

  it('liste favoris et historique des menus', async () => {
    const existing = createTestUseCases({ profile: TEST_PROFILE });
    const plan = await existing.useCases.getCurrentPlan();
    if (plan.status !== 'ready') throw new Error('pas de menu');
    const meal = plan.plan.meals.find((m) => !m.isLeftover);
    if (!meal) throw new Error('pas de repas');
    await existing.useCases.rateMeal({
      weekStart: plan.plan.weekStart,
      mealId: meal.id,
      verdict: 'up',
    });
    const { user } = renderScreen(<ProgressPage />, { existing });
    const name = plan.recipes[meal.recipeId]?.name ?? '';
    const favorites = (
      await screen.findByRole('heading', { name: /Mes recettes favorites/ })
    ).closest('section');
    expect(within(favorites as HTMLElement).getByRole('link', { name })).toBeInTheDocument();
    await user.click(screen.getByText(/Semaine du 23 novembre 2026/));
    expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(1);
  });
});
