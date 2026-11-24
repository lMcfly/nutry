import { screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderApp, TEST_PROFILE } from '../testing/renderApp';
import { resetPageFocusForTests } from '../components/Page';

describe('<App />', () => {
  beforeEach(() => {
    resetPageFocusForTests();
  });

  it('sans profil, démarre sur l’onboarding, sans onglets ni quiz', async () => {
    renderApp({ quiz: true });
    expect(await screen.findByRole('heading', { name: 'Tu as quel âge ?' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.location.hash).toBe('#/bienvenue');
  });

  it('onboarding complet → menu de la semaine affiché', async () => {
    const { user, ports } = renderApp();
    const ask = (name: string | RegExp) => screen.findByRole('heading', { name, level: 1 });
    const next = () => user.click(screen.getByRole('button', { name: 'Continuer' }));
    const skip = () => user.click(screen.getByRole('button', { name: 'Passer' }));

    // « Continuer » sans réponse affiche l'erreur douce de la question.
    await ask('Tu as quel âge ?');
    await next();
    expect(screen.getByText('Ce champ nous aide à ajuster tes portions.')).toBeVisible();

    await user.type(screen.getByLabelText('Âge'), '34');
    await next();
    await ask('Tu es…');
    await user.click(screen.getByRole('radio', { name: 'Homme' }));
    await ask('Tu mesures combien ?');
    await user.type(screen.getByLabelText('Taille'), '170');
    await next();
    await ask('Et tu pèses combien ?');
    await user.type(screen.getByLabelText('Poids'), '68,5');
    await next();
    await ask('Tu connais ton tour de taille ?');
    await skip();
    await ask('Tu bouges comment au quotidien ?');
    await user.click(screen.getByRole('radio', { name: /Actif/ }));
    // Le titre de la question prend le focus à chaque écran.
    expect(await ask(/condition de santé/)).toHaveFocus();
    await skip();

    await ask('Quel est ton objectif ?');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '8');
    await user.click(screen.getByRole('radio', { name: /Rééquilibrer/ }));
    await ask('Tu manges comment ?');
    await user.click(screen.getByRole('radio', { name: /Omnivore/ }));
    await ask(/« sans »/);
    await skip();
    await ask('Tu as des allergies ?');
    expect(screen.getByText(/ne sont pas prises en compte/)).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: /Arachides/ }));
    await next();

    await ask('Qu’est-ce que tu adores ?');
    await user.click(screen.getByRole('checkbox', { name: /Tomate/ }));
    await skip();
    await ask('Et ce que tu n’aimes pas ?');
    await skip();

    await ask('Vous êtes combien à table ?');
    await user.click(screen.getByRole('button', { name: 'Une personne de plus' }));
    expect(screen.getByLabelText('Combien êtes-vous à table ?')).toHaveValue('2');
    await next();
    for (let i = 0; i < 5; i += 1) await skip();
    await ask('Tu veux cuisiner en avance le dimanche ?');
    await user.click(screen.getByRole('button', { name: 'Voir mon menu' }));

    expect(await screen.findByRole('heading', { name: 'Ma semaine' })).toBeVisible();
    // Un seul repas à l'écran (la grande carte), les 7 jours dans le bandeau.
    expect(await screen.findByTestId('meal')).toBeVisible();
    expect(screen.getAllByRole('tab', { name: /novembre/ })).toHaveLength(7);
    expect(ports.state.plans.size).toBe(1);
    const tabs = within(screen.getByRole('navigation', { name: 'Navigation principale' }));
    expect(tabs.getAllByRole('link').map((l) => l.textContent)).toEqual([
      'Semaine',
      'Courses',
      'Moi',
    ]);
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
    await screen.findByRole('heading', { name: 'Tu as quel âge ?' });
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
    await user.click(screen.getByRole('link', { name: 'Moi' }));
    expect(await screen.findByRole('heading', { name: 'Moi', level: 1 })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Moi' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Progrès' })).toBeNull();
    // Anciennes adresses : Profil et Progrès mènent à « Moi ».
    window.location.hash = '#/progres';
    await waitFor(() => {
      expect(window.location.hash).toBe('#/moi');
    });
  });

  it('le lien d’évitement déplace le focus sur le contenu', async () => {
    const { user } = renderApp({ profile: TEST_PROFILE });
    await screen.findByRole('heading', { name: 'Ma semaine' });
    await user.click(screen.getByRole('link', { name: 'Aller au contenu' }));
    expect(screen.getByRole('main')).toHaveFocus();
    expect(window.location.hash).toBe('#/semaine');
  });
});
