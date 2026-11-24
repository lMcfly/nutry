import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OnboardingPage } from './OnboardingPage';
import { renderScreen } from '../testing/renderApp';

type User = ReturnType<typeof renderScreen>['user'];

const question = (name: string | RegExp) => screen.findByRole('heading', { name, level: 1 });

async function typeNumber(user: User, label: string, value: string) {
  await user.type(screen.getByLabelText(label), value);
  await user.click(screen.getByRole('button', { name: 'Continuer' }));
}

/** Âge, sexe (au doigt : la carte passe seule à la suite), taille, poids. */
async function fillAboutYou(
  user: User,
  values: { age: string; height: string; weight: string; sex: string },
) {
  await question('Tu as quel âge ?');
  await typeNumber(user, 'Âge', values.age);
  await question('Tu es…');
  await user.click(screen.getByRole('radio', { name: values.sex }));
  if (values.sex === 'Homme') {
    await question('Tu mesures combien ?');
    await typeNumber(user, 'Taille', values.height);
  } else {
    await question(/enceinte ou tu allaites/);
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await question('Tu mesures combien ?');
    await typeNumber(user, 'Taille', values.height);
  }
  await question('Et tu pèses combien ?');
  await typeNumber(user, 'Poids', values.weight);
}

/** Passe le tour de taille, l'activité (choix) et la santé jusqu'à la question de l'objectif. */
async function toGoal(user: User) {
  await question('Tu connais ton tour de taille ?');
  await user.click(screen.getByRole('button', { name: 'Passer' }));
  await question('Tu bouges comment au quotidien ?');
  await user.click(screen.getByRole('radio', { name: /Un peu actif/ }));
  await question(/condition de santé/);
  await user.click(screen.getByRole('button', { name: 'Passer' }));
  await question('Quel est ton objectif ?');
}

describe('<OnboardingPage />', () => {
  it('une question par écran, posée par Nutry, avec la progression', async () => {
    renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await question('Tu as quel âge ?');
    expect(screen.getByRole('progressbar', { name: 'Progression' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    expect(screen.getByRole('img', { name: /^Nutry, la petite boule/ })).toBeVisible();
    // Un seul champ : pas de formulaire à rallonge.
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
    expect(screen.getByRole('slider', { name: 'Âge, curseur' })).toHaveValue('42');
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

  it('grossesse : question posée à une femme seulement, perte grisée', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await question('Tu as quel âge ?');
    await typeNumber(user, 'Âge', '30');
    await question('Tu es…');
    await user.click(screen.getByRole('radio', { name: 'Femme' }));
    await question('Tu es enceinte ou tu allaites ?');
    await user.click(screen.getByRole('radio', { name: 'Oui' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await typeNumber(user, 'Taille', '165');
    await typeNumber(user, 'Poids', '70');
    await toGoal(user);
    expect(screen.getByRole('radio', { name: /Perdre en douceur/ })).toBeDisabled();
  });

  it('un homme ne se voit pas poser la question de grossesse', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await question('Tu as quel âge ?');
    await typeNumber(user, 'Âge', '30');
    await question('Tu es…');
    await user.click(screen.getByRole('radio', { name: 'Homme' }));
    await question('Tu mesures combien ?');
    expect(screen.queryByText(/enceinte/)).toBeNull();
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

  it('valeurs aberrantes signalées avec douceur', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await question('Tu as quel âge ?');
    await typeNumber(user, 'Âge', '30');
    await question('Tu es…');
    await user.click(screen.getByRole('radio', { name: 'Autre' }));
    await question(/enceinte/);
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await question('Tu mesures combien ?');
    await typeNumber(user, 'Taille', '1,75');
    expect(screen.getByText(/entre 100 et 250 cm/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Tu mesures combien ?' })).toBeVisible();
  });

  it('« Passer » sur les questions facultatives, puis retour arrière', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await fillAboutYou(user, { age: '30', height: '170', weight: '65', sex: 'Homme' });
    await toGoal(user);
    await user.click(screen.getByRole('radio', { name: /Rééquilibrer/ }));
    await question('Tu manges comment ?');
    await user.click(screen.getByRole('radio', { name: /Omnivore/ }));
    await question(/« sans »/);
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await question('Tu as des allergies ?');
    await user.click(screen.getByRole('checkbox', { name: /Arachides/ }));
    expect(screen.getByRole('checkbox', { name: /Arachides/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Retour' }));
    await question(/« sans »/);
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
    });
  });
});
