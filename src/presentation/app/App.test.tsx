import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp, TEST_PROFILE } from '../testing/renderApp';
import { resetPageFocusForTests } from '../components/Page';

describe('<App />', () => {
  beforeEach(() => {
    resetPageFocusForTests();
  });

  it('sans profil, démarre sur l’onboarding, sans onglets ni quiz', async () => {
    renderApp({ quiz: true });
    expect(await screen.findByRole('heading', { name: 'Faisons connaissance' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.hash).toBe('#/bienvenue');
  });

  it('onboarding complet → menu de la semaine affiché', async () => {
    const { user, ports } = renderApp();
    await screen.findByRole('heading', { name: 'Faisons connaissance' });

    // Écran 1 : « Continuer » sans réponse affiche des erreurs.
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getAllByText('Ce champ nous aide à ajuster tes portions.')).toHaveLength(3);

    await user.type(screen.getByLabelText('Âge'), '34');
    await user.type(screen.getByLabelText('Taille'), '170');
    await user.type(screen.getByLabelText('Poids'), '68,5');
    await user.click(screen.getByRole('radio', { name: 'Homme' }));
    await user.click(screen.getByRole('radio', { name: /Actif/ }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    // Écran 2 : objectif et allergies.
    expect(await screen.findByRole('heading', { name: 'Ton objectif' })).toHaveFocus();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByText(/ne sont pas prises en compte/)).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: 'Arachides' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    // Écran 3 : goûts (facultatif).
    await screen.findByRole('heading', { name: 'Tes goûts' });
    const likes = screen.getByRole('group', { name: /J’adore/ });
    await user.click(within(likes).getByRole('checkbox', { name: /Tomate/ }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));

    // Écran 4 : organisation.
    await screen.findByRole('heading', { name: 'Ton organisation' });
    await user.click(screen.getByRole('button', { name: 'Une personne de plus' }));
    expect(screen.getByText('2 personnes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voir mon menu' }));

    expect(await screen.findByRole('heading', { name: 'Ma semaine' })).toBeVisible();
    // Un seul repas à l'écran (la grande carte), les 7 jours dans le bandeau.
    expect(await screen.findByTestId('meal')).toBeVisible();
    expect(screen.getAllByRole('tab', { name: /novembre/ })).toHaveLength(7);
    expect(ports.state.plans.size).toBe(1);
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toHaveTextContent(
      /Semaine.*Courses.*Profil.*Progrès/,
    );
    expect(ports.state.profile).toMatchObject({
      age: 34,
      sex: 'homme',
      weightKg: 68.5,
      activity: 'modere',
      allergens: ['arachides'],
      likes: ['tomate'],
      householdSize: 2,
    });
    // Stockage persistant demandé à la fin de l'onboarding.
    expect(ports.state.settings.persistenceGranted).toBe(true);
    expect(document.title).toBe('Ma semaine · Nutry');
  });

  it('à l’étape 1, Nutry accueille la personne', async () => {
    renderApp();
    await screen.findByRole('heading', { name: 'Faisons connaissance' });
    expect(screen.getByRole('img', { name: /^Nutry, la petite boule/ })).toBeVisible();
    expect(screen.getByText(/Salut, moi c’est Nutry/)).toBeVisible();
  });

  it('un geste fait gagner un accessoire : célébration, puis acquittement', async () => {
    const { user, ports } = renderApp({ profile: TEST_PROFILE });
    await screen.findByTestId('meal');
    await user.click(screen.getByRole('button', { name: 'J’ai aimé' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bravo !' });
    expect(within(dialog).getByText(/Nutry a gagné la feuille sur la tête !/)).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: 'Génial !' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(ports.state.companion.acknowledgedBest).toBe(1);
  });

  it('navigue entre les onglets, titre et focus suivent la route', async () => {
    const { user } = renderApp({ profile: TEST_PROFILE });
    await screen.findByRole('heading', { name: 'Ma semaine' });
    await user.click(screen.getByRole('link', { name: 'Courses' }));
    const heading = await screen.findByRole('heading', { name: 'Mes courses', level: 1 });
    expect(heading).toHaveFocus();
    expect(document.title).toBe('Mes courses · Nutry');
    await user.click(screen.getByRole('link', { name: 'Progrès' }));
    expect(await screen.findByRole('heading', { name: 'Mes progrès' })).toBeVisible();
    await user.click(screen.getByRole('link', { name: 'Profil' }));
    expect(await screen.findByRole('heading', { name: 'Mon profil' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('aria-current', 'page');
  });

  it('le lien d’évitement déplace le focus sur le contenu', async () => {
    const { user } = renderApp({ profile: TEST_PROFILE });
    await screen.findByRole('heading', { name: 'Ma semaine' });
    await user.click(screen.getByRole('link', { name: 'Aller au contenu' }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('#/semaine');
  });
});
