import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MePage } from './MePage';
import { TEST_PROFILE, createTestUseCases, renderScreen } from '../testing/renderApp';

type User = ReturnType<typeof renderScreen>['user'];

/** Ouvre la feuille de saisie (« Noter ma mesure »). */
async function openMeasureSheet(user: User): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name: 'Noter ma mesure' }));
  return screen.findByRole('dialog', { name: 'Ma mesure de la semaine' });
}

describe('<MePage />', () => {
  it('une page : Nutry et série en haut, progrès en cartes sans pourcentage, accès aux feuilles', async () => {
    const { user } = renderScreen(<MePage />);
    expect(await screen.findByText(/Pas de série en cours/)).toBeVisible();
    expect(screen.getByRole('img', { name: /^Nutry, la petite boule/ })).toBeVisible();
    // L'équilibre est une carte à pastilles qui ouvre une feuille (pas de jauges sur l'écran).
    expect(screen.queryAllByRole('meter')).toHaveLength(0);
    const rows = await screen.findAllByRole('img', {
      name: /^(Légumes|Poissons|Légumineuses|Céréales).* : \d+ sur \d+$/,
    });
    expect(rows.length).toBe(4);
    expect(document.body.textContent).not.toMatch(/\d\s?%/);
    await user.click(screen.getByRole('button', { name: /L’équilibre de ta semaine/ }));
    const sheet = await screen.findByRole('dialog', { name: 'L’équilibre de ta semaine' });
    expect(within(sheet).getAllByRole('meter')).toHaveLength(4);
    await user.click(within(sheet).getByRole('button', { name: 'Fermer' }));
    expect(screen.getByRole('button', { name: /Favoris/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Historique/ })).toBeVisible();
  });

  it('saisie hebdomadaire, courbe accessible et suppression', async () => {
    const existing = createTestUseCases({ profile: TEST_PROFILE });
    existing.ports.state.progress.set('2026-11-09', { date: '2026-11-09', weightKg: 63 });
    existing.ports.state.progress.set('2026-11-16', { date: '2026-11-16', weightKg: 62.4 });
    const { user, ports } = renderScreen(<MePage />, { existing });
    const sheet = await openMeasureSheet(user);
    await user.type(within(sheet).getByLabelText('Poids'), '62,1');
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText(/bravo pour ta régularité/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(ports.state.progress.get('2026-11-23')?.weightKg).toBe(62.1);

    const chart = await screen.findByRole('img', { name: 'Poids, tendance lissée' });
    expect(chart).toHaveAccessibleDescription(/3 mesures/);
    expect(screen.getByRole('table', { hidden: true })).toBeInTheDocument();

    const again = await openMeasureSheet(user);
    await user.click(within(again).getByText(/Mes mesures/));
    await user.click(
      within(again).getByRole('button', { name: /Supprimer la mesure du 9 novembre/ }),
    );
    await waitFor(() => {
      expect(ports.state.progress.has('2026-11-09')).toBe(false);
    });
  });

  it('une 2e saisie dans la semaine met à jour la mesure de la semaine', async () => {
    const existing = createTestUseCases({ profile: TEST_PROFILE });
    existing.ports.clock.set('2026-11-25T10:00:00.000Z');
    existing.ports.state.progress.set('2026-11-24', { date: '2026-11-24', waistCm: 80 });
    const { user } = renderScreen(<MePage />, { existing });
    const sheet = await openMeasureSheet(user);
    await user.type(within(sheet).getByLabelText('Tour de taille'), '79');
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Mesure de la semaine mise à jour.')).toBeInTheDocument();
  });

  it('suivi du poids désactivé par défaut : formulation douce et activation', async () => {
    const { user, ports } = renderScreen(<MePage />, {
      profile: { ...TEST_PROFILE, age: 16 },
    });
    const card = (await screen.findByRole('heading', { name: /Suivi du poids/ })).closest(
      'section',
    );
    expect(card).toHaveTextContent(/on mise sur le plaisir de manger varié et sur ton énergie/);
    const before = await openMeasureSheet(user);
    expect(within(before).queryByLabelText('Poids')).toBeNull();
    expect(within(before).getByLabelText('Tour de taille')).toBeInTheDocument();
    await user.click(within(before).getByRole('button', { name: 'Fermer' }));
    await user.click(
      within(card as HTMLElement).getByRole('button', { name: 'Activer le suivi du poids' }),
    );
    expect(await screen.findByRole('heading', { name: /Ta tendance/ })).toBeVisible();
    const after = await openMeasureSheet(user);
    expect(within(after).getByLabelText('Poids')).toBeInTheDocument();
    expect(ports.state.settings.weightTracking).toBe(true);
  });

  it.each([
    ['grossesse', { sex: 'femme', pregnantOrBreastfeeding: true }],
    ['condition de santé', { healthCondition: true }],
    // 2 m : IMC = poids / 4 → 18,49, puis 21,9 à 70 ans.
    ['IMC bas', { age: 40, heightCm: 200, weightKg: 73.96 }],
    ['IMC bas après 70 ans', { age: 70, heightCm: 200, weightKg: 87.6 }],
  ] as const)(
    'profil protégé (%s) : suivi masqué, carte douce sans jugement',
    async (_label, overrides) => {
      const { user } = renderScreen(<MePage />, {
        profile: { ...TEST_PROFILE, ...overrides },
      });
      const card = (await screen.findByRole('heading', { name: /Suivi du poids/ })).closest(
        'section',
      ) as HTMLElement;
      expect(card).toHaveTextContent(/tu peux l’activer quand tu veux/);
      expect(card.textContent).not.toMatch(
        /IMC|risque|maigre|insuffisan|danger|santé|médecin|en pause|y tiens vraiment/i,
      );
      const sheet = await openMeasureSheet(user);
      expect(within(sheet).queryByLabelText('Poids')).toBeNull();
    },
  );

  it('profil standard : poids proposé, pas de carte de suivi désactivé', async () => {
    const existing = createTestUseCases({ profile: TEST_PROFILE });
    const { user } = renderScreen(<MePage />, { existing });
    const sheet = await openMeasureSheet(user);
    expect(within(sheet).getByLabelText('Poids')).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('heading', { name: /Suivi du poids/ })).toBeNull();
  });

  it('profil standard qui a mis le suivi en pause : formulation « en pause »', async () => {
    const existing = createTestUseCases({ profile: TEST_PROFILE });
    await existing.useCases.setWeightTracking(false);
    renderScreen(<MePage />, { existing });
    const card = (await screen.findByRole('heading', { name: /Suivi du poids/ })).closest(
      'section',
    );
    expect(card).toHaveTextContent(/Le suivi du poids est en pause/);
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
    const { user } = renderScreen(<MePage />, { existing });
    const name = plan.recipes[meal.recipeId]?.name ?? '';
    await user.click(await screen.findByRole('button', { name: /Favoris/ }));
    const favorites = await screen.findByRole('dialog', { name: 'Mes recettes favorites' });
    expect(within(favorites).getByRole('link', { name })).toBeInTheDocument();
    await user.click(within(favorites).getByRole('button', { name: 'Fermer' }));
    await user.click(screen.getByRole('button', { name: /Historique/ }));
    const history = await screen.findByRole('dialog', { name: 'Mes menus passés' });
    await user.click(within(history).getByText(/Semaine du 23 novembre 2026/));
    expect(within(history).getAllByRole('link', { name }).length).toBeGreaterThan(0);
  });
});
