import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Recipe } from '@domain/recipe';
import { FIXTURE_RECIPES } from '@domain/testing/fixtures';
import { DISLIKED_TOAST, REPLACE_NOW_LABEL, WeekPage } from './WeekPage';
import { CelebrationProvider } from '../features/companion/Celebration';
import { TEST_PROFILE, renderScreen } from '../testing/renderApp';

/** La grande carte du repas sélectionné (une seule à la fois). */
async function currentMeal() {
  return screen.findByTestId('meal');
}

const mealId = (el: HTMLElement) => el.getAttribute('data-meal-id');

describe('<WeekPage />', () => {
  it('affiche le repas du jour, ses jauges d’assiette et les accès rapides', async () => {
    renderScreen(<WeekPage />);
    const meal = await currentMeal();
    // Une seule grande carte ; le bandeau des 7 jours, aujourd'hui (lundi 23) sélectionné.
    expect(screen.getAllByTestId('meal')).toHaveLength(1);
    expect(mealId(meal)).toBe('0-dejeuner');
    expect(screen.getAllByRole('tab', { name: /\d{2} novembre/ })).toHaveLength(7);
    expect(screen.getByRole('tab', { name: 'Lundi 23 novembre, aujourd’hui' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // Onglets repas du jour : déjeuner sélectionné, dîner disponible.
    expect(screen.getByRole('tab', { name: 'Déjeuner' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Dîner' })).toBeVisible();
    // Jauges d'assiette (légumes, protéines, féculents), jamais de calories.
    expect(within(meal).getAllByRole('meter')).toHaveLength(3);
    expect(within(meal).getByRole('meter', { name: 'Légumes' })).toBeVisible();
    expect(within(meal).getByText(/Pourquoi ce plat \?/)).toBeVisible();
    expect(within(meal).getByRole('link', { name: 'Voir la recette' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/recette\//),
    );
    expect(screen.getByRole('link', { name: /Frigo vide/ })).toHaveAttribute('href', '/frigo');
    expect(document.body.textContent).not.toMatch(/kcal/);
  });

  it('l’équilibre de la semaine s’ouvre dans une feuille avec ses 4 jauges', async () => {
    const { user } = renderScreen(<WeekPage />);
    await currentMeal();
    await user.click(screen.getByRole('button', { name: 'Équilibre de la semaine' }));
    const sheet = await screen.findByRole('dialog', { name: 'L’équilibre de ta semaine' });
    expect(within(sheet).getAllByRole('meter')).toHaveLength(4);
  });

  it('change de jour et de repas : bandeau, onglets, boutons précédent et suivant', async () => {
    const { user } = renderScreen(<WeekPage />);
    const first = await currentMeal();
    expect(mealId(first)).toBe('0-dejeuner');

    await user.click(screen.getByRole('tab', { name: 'Dîner' }));
    expect(mealId(await currentMeal())).toBe('0-diner');

    // Le jour suivant garde le repas choisi (dîner).
    await user.click(screen.getByRole('tab', { name: 'Mardi 24 novembre' }));
    expect(mealId(await currentMeal())).toBe('1-diner');
    expect(screen.getByRole('tab', { name: 'Mardi 24 novembre' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Repas suivant' }));
    expect(mealId(await currentMeal())).toBe('2-dejeuner');
    await user.click(screen.getByRole('button', { name: 'Repas précédent' }));
    expect(mealId(await currentMeal())).toBe('1-diner');
  });

  it('les flèches du clavier parcourent les jours', async () => {
    const { user } = renderScreen(<WeekPage />);
    await currentMeal();
    screen.getByRole('tab', { name: 'Lundi 23 novembre, aujourd’hui' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Mardi 24 novembre' })).toHaveFocus();
    expect(mealId(await currentMeal())).toBe('1-dejeuner');
    await user.keyboard('{End}');
    expect(mealId(await currentMeal())).toBe('6-dejeuner');
  });

  it('un glissement vers la gauche passe au repas suivant, vers la droite au précédent', async () => {
    renderScreen(<WeekPage />);
    await currentMeal();
    const swipe = (from: number, to: number) => {
      const zone = screen.getByTestId('swipeable');
      fireEvent.pointerDown(zone, { clientX: from, clientY: 200, pointerType: 'touch' });
      fireEvent.pointerUp(window, { clientX: to, clientY: 205, pointerType: 'touch' });
    };
    swipe(300, 100);
    await waitFor(async () => {
      expect(mealId(await currentMeal())).toBe('0-diner');
    });
    swipe(100, 300);
    await waitFor(async () => {
      expect(mealId(await currentMeal())).toBe('0-dejeuner');
    });
    // Un petit geste ou un geste surtout vertical ne change rien.
    swipe(200, 180);
    expect(mealId(await currentMeal())).toBe('0-dejeuner');
  });

  it('remplace un repas par l’une des 3 alternatives', async () => {
    const { user, ports } = renderScreen(<WeekPage />);
    const meal = await currentMeal();
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
    const meal = await currentMeal();
    const disliked = [...ports.state.plans.values()][0]?.meals[0]?.recipeId;
    await user.click(within(meal).getByRole('button', { name: 'Pas pour moi' }));
    await waitFor(() => {
      expect(within(meal).getByRole('button', { name: 'Pas pour moi' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    const reasons = await screen.findByRole('dialog', { name: 'Une raison ?' });
    await user.click(within(reasons).getByRole('radio', { name: 'Pas aimé le goût' }));
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

  it('👎 « pas aimé » : un toast propose de remplacer le plat tout de suite', async () => {
    const { user } = renderScreen(<WeekPage />);
    const meal = await currentMeal();
    await user.click(within(meal).getByRole('button', { name: 'Pas pour moi' }));
    await user.click(await screen.findByRole('radio', { name: 'Pas aimé le goût' }));
    expect(await screen.findByText(DISLIKED_TOAST)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: REPLACE_NOW_LABEL }));
    const sheet = await screen.findByRole('dialog', { name: 'Remplacer ce repas' });
    expect(within(sheet).getByText(/Lundi/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: REPLACE_NOW_LABEL })).toBeNull();
  });

  it('👎 « trop long » : pas de proposition de remplacement immédiat', async () => {
    const { user, ports } = renderScreen(<WeekPage />);
    const meal = await currentMeal();
    await user.click(within(meal).getByRole('button', { name: 'Pas pour moi' }));
    await user.click(await screen.findByRole('radio', { name: /Trop long/ }));
    await waitFor(() => {
      expect([...ports.state.ratings.values()][0]?.reason).toBe('trop-long');
    });
    expect(screen.queryByRole('button', { name: REPLACE_NOW_LABEL })).toBeNull();
  });

  it('👍 puis re-clic retire l’avis', async () => {
    const { user, ports } = renderScreen(<WeekPage />);
    const meal = await currentMeal();
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

  it('après un 👍, Nutry passe à « joyeux » sans recharger la page', async () => {
    const { user } = renderScreen(
      <CelebrationProvider>
        <WeekPage />
      </CelebrationProvider>,
    );
    const meal = await currentMeal();
    expect(await screen.findByRole('img', { name: /il est content/ })).toBeVisible();
    await user.click(within(meal).getByRole('button', { name: 'J’ai aimé' }));
    await waitFor(() => {
      expect(screen.getAllByRole('img', { name: /il est joyeux/ }).length).toBeGreaterThan(0);
    });
  });

  it('signale les restes et le batch cooking', async () => {
    const { user } = renderScreen(<WeekPage />, {
      profile: { ...TEST_PROFILE, batchCooking: true },
    });
    await currentMeal();
    await user.click(screen.getByRole('button', { name: 'Cuisiner en avance le dimanche' }));
    const batch = await screen.findByRole('dialog', { name: 'Cuisiner en avance le dimanche' });
    // Préparations groupées par famille, chacune avec ses repas.
    expect(within(batch).getAllByRole('heading', { level: 3 }).length).toBeGreaterThan(0);
    expect(
      within(batch).getAllByText(/^pour (lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) – /)
        .length,
    ).toBeGreaterThan(0);
    await user.click(within(batch).getByRole('button', { name: 'Fermer' }));

    // Les restes sont reliés à leur plat d'origine : la pastille mène au repas source.
    for (let i = 0; i < 13; i += 1) {
      const pill = screen.queryByRole('button', { name: /^Restes (du|pour le) / });
      if (pill) {
        const before = mealId(await currentMeal());
        await user.click(pill);
        expect(mealId(await currentMeal())).not.toBe(before);
        break;
      }
      await user.click(screen.getByRole('button', { name: 'Repas suivant' }));
    }
  });

  it('sans batch cooking, pas de raccourci « dimanche »', async () => {
    renderScreen(<WeekPage />);
    await currentMeal();
    expect(screen.queryByRole('button', { name: 'Cuisiner en avance le dimanche' })).toBeNull();
  });

  it('suggère du pain complet pour les recettes étiquetées', async () => {
    const recipes: Recipe[] = FIXTURE_RECIPES.map((r) => ({
      ...r,
      tags: [...r.tags, 'accompagner-pain' as const],
    }));
    renderScreen(<WeekPage />, { recipes });
    await currentMeal();
    expect(screen.getAllByText('Avec une tranche de pain complet 🍞').length).toBeGreaterThan(0);
  });
});
