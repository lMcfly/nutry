import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OnboardingPage } from './OnboardingPage';
import { renderScreen } from '../testing/renderApp';

type User = ReturnType<typeof renderScreen>['user'];

const question = (name: string | RegExp) => screen.findByRole('heading', { name, level: 1 });

const next = (user: User) => user.click(screen.getByRole('button', { name: 'Continuer' }));

async function typeNumber(user: User, label: string, value: string) {
  await user.type(screen.getByLabelText(label), value);
  await next(user);
}

/** Âge, sexe (avec la grossesse si elle est posée), puis taille et poids côte à côte. */
async function fillAboutYou(
  user: User,
  values: { age: string; height: string; weight: string; sex: string },
) {
  await question('Tu as quel âge ?');
  await typeNumber(user, 'Âge', values.age);
  await question('Tu es…');
  await user.click(screen.getByRole('radio', { name: values.sex }));
  await next(user);
  await question('Ta taille et ton poids ?');
  await user.type(screen.getByLabelText('Taille'), values.height);
  await user.type(screen.getByLabelText('Poids'), values.weight);
  await next(user);
}

/** L'activité (choix unique : passe seule à la suite) et la santé jusqu'à l'objectif. */
async function toGoal(user: User) {
  await question('Tu bouges comment au quotidien ?');
  await user.click(screen.getByRole('radio', { name: /Un peu actif/ }));
  await question(/condition de santé/);
  await user.click(screen.getByRole('button', { name: 'Passer' }));
  await question('Quel est ton objectif ?');
}

describe('<OnboardingPage />', () => {
  it('un thème par écran, posé par Nutry, avec la progression', async () => {
    renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await question('Tu as quel âge ?');
    expect(screen.getByRole('progressbar', { name: 'Progression' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    expect(screen.getByRole('img', { name: /^Nutry, la petite boule/ })).toBeVisible();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '9');
    // Un seul thème : pas de formulaire à rallonge.
    expect(screen.queryByLabelText('Taille')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retour' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Passer' })).toBeNull();
  });

  it('le chiffre se règle avec + et − et se tape au clavier', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await question('Tu as quel âge ?');
    const age = screen.getByLabelText('Âge');
    await user.click(screen.getByRole('button', { name: 'Augmenter : Âge' }));
    expect(age).toHaveValue('30');
    await user.click(screen.getByRole('button', { name: 'Augmenter : Âge' }));
    expect(age).toHaveValue('31');
    await user.click(screen.getByRole('button', { name: 'Diminuer : Âge' }));
    expect(age).toHaveValue('30');
    await user.clear(age);
    await user.type(age, '42');
    expect(screen.getByRole('slider', { name: 'Âge, règle' })).toHaveAttribute(
      'aria-valuenow',
      '42',
    );
  });

  it('un nombre manquant est signalé avec douceur', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await question('Tu as quel âge ?');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/nous aide à ajuster tes portions/);
    expect(screen.getByRole('heading', { name: 'Tu as quel âge ?' })).toBeVisible();
  });

  it('grise « perdre en douceur » pour un profil protégé (moins de 18 ans)', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await fillAboutYou(user, { age: '16', height: '165', weight: '55', sex: 'Femme' });
    await toGoal(user);
    const loss = screen.getByRole('radio', { name: /Perdre en douceur/ });
    expect(loss).toBeDisabled();
    expect(loss).toHaveAccessibleName(/Pas proposé pour ton profil/);
    expect(screen.getByText(/Avant 18 ans/)).toBeVisible();
  });

  it('grossesse : interrupteur proposé à une femme seulement, perte grisée', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await question('Tu as quel âge ?');
    await typeNumber(user, 'Âge', '30');
    await question('Tu es…');
    expect(screen.queryByRole('switch', { name: /Enceinte ou allaitante/ })).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Femme' }));
    // Le choix du sexe ne change pas d'écran : la grossesse apparaît sur le même écran.
    const pregnancy = await screen.findByRole('switch', { name: /Enceinte ou allaitante/ });
    expect(screen.getByRole('heading', { name: 'Tu es…' })).toBeVisible();
    await user.click(pregnancy);
    await next(user);
    await question('Ta taille et ton poids ?');
    await user.type(screen.getByLabelText('Taille'), '165');
    await user.type(screen.getByLabelText('Poids'), '70');
    await next(user);
    await toGoal(user);
    expect(screen.getByRole('radio', { name: /Perdre en douceur/ })).toBeDisabled();
  });

  it('un homme ne se voit pas proposer la grossesse, même après un autre choix', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await question('Tu as quel âge ?');
    await typeNumber(user, 'Âge', '30');
    await question('Tu es…');
    await user.click(screen.getByRole('radio', { name: 'Autre' }));
    expect(screen.getByRole('switch', { name: /Enceinte ou allaitante/ })).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'Homme' }));
    expect(screen.queryByRole('switch', { name: /Enceinte ou allaitante/ })).toBeNull();
    await next(user);
    await question('Ta taille et ton poids ?');
    expect(screen.queryByText(/enceinte/i)).toBeNull();
  });

  it('adulte sans contre-indication : perte proposée, et le choix passe seul à la suite', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await fillAboutYou(user, { age: '40', height: '175', weight: '85', sex: 'Homme' });
    await toGoal(user);
    const loss = screen.getByRole('radio', { name: /Perdre en douceur/ });
    expect(loss).toBeEnabled();
    await user.click(loss);
    await question('Tu manges comment ?');
  });

  it('valeurs aberrantes signalées avec douceur, l’écran ne change pas', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await question('Tu as quel âge ?');
    await typeNumber(user, 'Âge', '30');
    await question('Tu es…');
    await user.click(screen.getByRole('radio', { name: 'Autre' }));
    await next(user);
    await question('Ta taille et ton poids ?');
    await user.type(screen.getByLabelText('Taille'), '1,75');
    await user.type(screen.getByLabelText('Poids'), '70');
    await next(user);
    expect(screen.getByText(/entre 100 et 250 cm/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Ta taille et ton poids ?' })).toBeVisible();
  });

  it('taille et poids côte à côte, tour de taille facultatif replié', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await fillAboutYou(user, { age: '30', height: '170', weight: '65', sex: 'Homme' });
    await question('Tu bouges comment au quotidien ?');
    await user.click(screen.getByRole('button', { name: 'Retour' }));
    await question('Ta taille et ton poids ?');
    expect(screen.queryByLabelText('Tour de taille')).toBeNull();
    await user.click(screen.getByRole('button', { name: '+ Ajouter mon tour de taille' }));
    const waist = screen.getByLabelText('Tour de taille');
    // Une valeur facultative mal saisie bloque, avec douceur, jusqu'à être corrigée ou retirée.
    await user.type(waist, '5');
    await next(user);
    expect(screen.getByRole('heading', { name: 'Ta taille et ton poids ?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retirer mon tour de taille' }));
    expect(screen.queryByLabelText('Tour de taille')).toBeNull();
    await next(user);
    await question('Tu bouges comment au quotidien ?');
  });

  it('« Passer » sur les écrans facultatifs, régime et allergies sans avance auto, retour', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await fillAboutYou(user, { age: '30', height: '170', weight: '65', sex: 'Homme' });
    await toGoal(user);
    await user.click(screen.getByRole('radio', { name: /Rééquilibrer/ }));
    await question('Tu manges comment ?');
    // Régime et allergies sur le même écran : on coche sans quitter l'écran.
    await user.click(screen.getByRole('radio', { name: /Végétarien/ }));
    await user.click(screen.getByRole('checkbox', { name: /Arachides/ }));
    expect(screen.getByRole('checkbox', { name: /Arachides/ })).toBeChecked();
    expect(screen.getByText(/ne sont pas prises en compte/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Passer' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Tu manges comment ?' })).toBeVisible();
    await next(user);
    await question(/aimes, ou pas/);
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await question('Comment tu t’organises ?');
    await user.click(screen.getByRole('button', { name: 'Retour' }));
    await question(/aimes, ou pas/);
    await user.click(screen.getByRole('button', { name: 'Retour' }));
    await question('Tu manges comment ?');
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '7');
    });
    expect(screen.getByRole('radio', { name: /Végétarien/ })).toBeChecked();
  });
});
