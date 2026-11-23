import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Recipe } from '@domain/recipe';
import { FIXTURE_RECIPES } from '@domain/testing/fixtures';
import { WeekPage } from './WeekPage';
import { TEST_PROFILE, renderScreen } from '../testing/renderApp';

async function firstMeal() {
  await waitFor(() => {
    expect(screen.getAllByTestId('meal').length).toBeGreaterThan(0);
  });
  const meal = screen.getAllByTestId('meal')[0];
  if (!meal) throw new Error('aucun repas');
  return meal;
}

describe('<WeekPage />', () => {
  it('affiche la semaine, les jauges et l’accès au frigo vide', async () => {
    renderScreen(<WeekPage />);
    await firstMeal();
    expect(screen.getAllByTestId('meal')).toHaveLength(14);
    // « Aujourd'hui » vient de l'horloge injectée (lundi 23 novembre dans les tests).
    expect(screen.getByRole('heading', { name: /Lundi 23 novembre.*Aujourd’hui/ })).toBeVisible();
    expect(screen.getByRole('link', { name: /Frigo vide/ })).toHaveAttribute('href', '/frigo');
    expect(screen.getByRole('heading', { name: /L’équilibre de ta semaine/ })).toBeVisible();
    expect(screen.getAllByRole('meter')).toHaveLength(4);
    expect(screen.getAllByText(/Pourquoi ce plat \?/).length).toBeGreaterThan(0);
    // Aucune calorie sur l'écran Semaine.
    expect(document.body.textContent).not.toMatch(/kcal/);
  });

  it('remplace un repas par l’une des 3 alternatives', async () => {
    const { user, ports } = renderScreen(<WeekPage />);
    const meal = await firstMeal();
    const before = [...ports.state.plans.values()][0]?.meals[0]?.recipeId;
    await user.click(within(meal).getByRole('button', { name: /Remplacer/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Remplacer ce repas' });
    const options = await within(sheet).findAllByRole('button', { name: /min/ });
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(3);
    const choice = options[0];
    if (!choice) throw new Error('aucune alternative');
    await user.click(choice);
    expect(await screen.findByText('C’est remplacé !')).toBeInTheDocument();
    await waitFor(() => {
      expect([...ports.state.plans.values()][0]?.meals[0]?.recipeId).not.toBe(before);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('👎 « pas aimé » puis nouveau menu : le plat disparaît', async () => {
    const { user, ports } = renderScreen(<WeekPage />);
    const meal = await firstMeal();
    const disliked = [...ports.state.plans.values()][0]?.meals[0]?.recipeId;
    await user.click(within(meal).getByRole('button', { name: 'Pas pour moi' }));
    await waitFor(() => {
      expect(within(meal).getByRole('button', { name: 'Pas pour moi' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    await user.click(within(meal).getByRole('radio', { name: 'Pas aimé le goût' }));
    await waitFor(() => {
      expect([...ports.state.ratings.values()][0]).toMatchObject({
        verdict: 'down',
        reason: 'pas-aime',
        recipeId: disliked,
      });
    });

    await user.click(screen.getByRole('button', { name: /Nouveau menu/ }));
    const confirm = await screen.findByRole('alertdialog', { name: 'Un nouveau menu ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Oui, on change' }));
    expect(await screen.findByText('Ton nouveau menu est prêt.')).toBeInTheDocument();
    const plan = [...ports.state.plans.values()][0];
    expect(plan?.meals.map((m) => m.recipeId)).not.toContain(disliked);
  });

  it('👍 puis re-clic retire l’avis', async () => {
    const { user, ports } = renderScreen(<WeekPage />);
    const meal = await firstMeal();
    await user.click(within(meal).getByRole('button', { name: 'J’ai aimé' }));
    await waitFor(() => {
      expect(ports.state.ratings.size).toBe(1);
    });
    await waitFor(() => {
      expect(within(meal).getByRole('button', { name: 'J’ai aimé' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    await user.click(within(meal).getByRole('button', { name: 'J’ai aimé' }));
    await waitFor(() => {
      expect(ports.state.ratings.size).toBe(0);
    });
  });

  it('signale les restes et le batch cooking', async () => {
    const { user } = renderScreen(<WeekPage />, {
      profile: { ...TEST_PROFILE, batchCooking: true },
    });
    await firstMeal();
    expect(screen.getByRole('heading', { name: /Batch cooking du dimanche/ })).toBeVisible();
    const pills = screen.queryAllByRole('button', { name: /Restes du/ });
    if (pills.length > 0 && pills[0]) {
      await user.click(pills[0]);
      expect(document.activeElement).toHaveAttribute('data-testid', 'meal');
    }
  });

  it('suggère du pain complet pour les recettes étiquetées', async () => {
    const recipes: Recipe[] = FIXTURE_RECIPES.map((r) => ({
      ...r,
      tags: [...r.tags, 'accompagner-pain' as const],
    }));
    renderScreen(<WeekPage />, { recipes });
    await firstMeal();
    expect(screen.getAllByText('Avec une tranche de pain complet 🍞').length).toBeGreaterThan(0);
  });
});
