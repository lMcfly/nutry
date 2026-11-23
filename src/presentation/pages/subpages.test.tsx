import { screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FIXTURE_RECIPES } from '@domain/testing/fixtures';
import { FridgePage } from './FridgePage';
import { PrivacyPage } from './PrivacyPage';
import { CIQUAL_CITATION } from '../i18n/labels';
import { MEDICAL_DISCLAIMER } from '@domain/profile';
import { PROCESSED_PRODUCTS_NOTICE, RecipePage } from './RecipePage';
import { TEST_PROFILE, createTestUseCases, renderScreen } from '../testing/renderApp';

function recipeRoute() {
  return (
    <Routes>
      <Route path="/recette/:id" element={<RecipePage />} />
    </Routes>
  );
}

describe('<RecipePage />', () => {
  it('détail d’un plat du menu : portions, étapes, allergènes, kcal repliées, favori', async () => {
    const existing = createTestUseCases({ profile: TEST_PROFILE });
    const plan = await existing.useCases.getCurrentPlan();
    if (plan.status !== 'ready') throw new Error('pas de menu');
    const meal = plan.plan.meals.find((m) => !m.isLeftover);
    const recipe = meal ? plan.recipes[meal.recipeId] : undefined;
    if (!recipe) throw new Error('pas de recette');

    const { user, ports } = renderScreen(recipeRoute(), {
      route: `/recette/${recipe.id}`,
      existing,
    });
    expect(await screen.findByRole('heading', { name: recipe.name, level: 1 })).toBeVisible();
    expect(screen.getByText(/Pour 2 personnes/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Étapes' })).toBeVisible();
    expect(screen.getByText(PROCESSED_PRODUCTS_NOTICE, { exact: false })).toBeVisible();
    const details = screen.getByText('Détail nutritionnel (optionnel)').closest('details');
    expect(details).not.toHaveAttribute('open');
    expect(within(details as HTMLElement).getByText(/kcal/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Ajouter aux favoris/ }));
    await waitFor(() => {
      expect(ports.state.ratings.size).toBe(1);
    });
    expect(await screen.findByRole('button', { name: /Dans tes favoris/ })).toBeDisabled();
  });

  it('recette hors menu (frigo vide, lien profond, rechargement) : trouvée par getRecipe', async () => {
    const existing = createTestUseCases({ profile: TEST_PROFILE });
    const plan = await existing.useCases.getCurrentPlan();
    if (plan.status !== 'ready') throw new Error('pas de menu');
    const outside = FIXTURE_RECIPES.find((r) => plan.recipes[r.id] === undefined);
    if (!outside) throw new Error('toutes les fixtures sont au menu');
    renderScreen(recipeRoute(), { route: `/recette/${outside.id}`, existing });
    expect(await screen.findByRole('heading', { name: outside.name, level: 1 })).toBeVisible();
    // Hors menu : pas de bouton favori (il s'appuie sur un repas noté).
    expect(screen.queryByRole('button', { name: /favoris/ })).toBeNull();
  });

  it('recette inconnue : message doux', async () => {
    renderScreen(recipeRoute(), { route: '/recette/inconnue' });
    expect(await screen.findByText('Cette recette n’est plus disponible')).toBeVisible();
  });
});

describe('<FridgePage />', () => {
  it('propose des recettes triées par ingrédients manquants', async () => {
    const { user } = renderScreen(<FridgePage />);
    const search = await screen.findByLabelText('Chercher un ingrédient');
    const ingredient = FIXTURE_RECIPES[0]?.ingredients.find((i) => i.aisle === 'fruits-legumes');
    if (!ingredient) throw new Error('fixture sans légume');
    await user.type(search, ingredient.name);
    await user.click(await screen.findByRole('button', { name: ingredient.name, pressed: false }));
    expect(screen.getByRole('heading', { name: /J’ai \(1\)/ })).toBeVisible();
    const ideas = await screen.findAllByRole('link');
    expect(ideas.length).toBeGreaterThan(0);
    const counts = screen
      .getAllByText(/manquants?$|Tu as tout/)
      .map((el) => (el.textContent.startsWith('Tu as tout') ? 0 : parseInt(el.textContent)));
    expect([...counts].sort((a, b) => a - b)).toEqual(counts);
    expect(screen.getAllByText(/Il te manque/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Tout retirer' }));
    expect(screen.getByText('Ton frigo, ton menu')).toBeVisible();
  });
});

describe('<PrivacyPage />', () => {
  it('explique que tout reste sur l’appareil et cite Ciqual', async () => {
    renderScreen(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: 'Tout reste sur ton appareil' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Aucun traceur' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Hébergée par GitHub Pages' })).toBeVisible();
    expect(screen.getByText(/GitHub voit ton adresse IP/)).toBeVisible();
    expect(screen.getByText(/thème choisi .* est gardé dans ce navigateur/)).toBeVisible();
    expect(screen.getByText(MEDICAL_DISCLAIMER)).toBeVisible();
    expect(screen.getByText(new RegExp(CIQUAL_CITATION))).toBeVisible();
    expect(screen.getByRole('link', { name: 'Licence Ouverte' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Exporter ou tout effacer/ })).toHaveAttribute(
      'href',
      '/profil#mes-donnees',
    );
    expect(await screen.findByText(/navigateur peut effacer/)).toBeVisible();
  });
});
