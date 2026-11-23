import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OnboardingPage } from './OnboardingPage';
import { renderScreen } from '../testing/renderApp';

async function fillAboutYou(
  user: ReturnType<typeof renderScreen>['user'],
  values: { age: string; height: string; weight: string; sex: string },
) {
  await user.type(screen.getByLabelText('Âge'), values.age);
  await user.type(screen.getByLabelText('Taille'), values.height);
  await user.type(screen.getByLabelText('Poids'), values.weight);
  await user.click(screen.getByRole('radio', { name: values.sex }));
}

describe('<OnboardingPage />', () => {
  it('grise « perdre en douceur » pour un profil protégé (moins de 18 ans)', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await fillAboutYou(user, { age: '16', height: '165', weight: '55', sex: 'Femme' });
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await screen.findByRole('heading', { name: 'Ton objectif' });
    const loss = screen.getByRole('radio', { name: /Perdre en douceur/ });
    expect(loss).toBeDisabled();
    expect(loss).toHaveAccessibleName(/Pas proposé pour ton profil/);
    expect(screen.getByText(/Avant 18 ans/)).toBeVisible();
  });

  it('grossesse : question affichée pour une femme, perte grisée', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    expect(screen.queryByRole('switch', { name: 'Enceinte ou allaitante' })).toBeNull();
    await fillAboutYou(user, { age: '30', height: '165', weight: '70', sex: 'Femme' });
    await user.click(screen.getByRole('switch', { name: 'Enceinte ou allaitante' }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByRole('radio', { name: /Perdre en douceur/ })).toBeDisabled();
  });

  it('adulte sans contre-indication : perte proposée', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await fillAboutYou(user, { age: '40', height: '175', weight: '85', sex: 'Homme' });
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    const loss = await screen.findByRole('radio', { name: /Perdre en douceur/ });
    expect(loss).toBeEnabled();
    await user.click(loss);
    expect(loss).toBeChecked();
  });

  it('valeurs aberrantes signalées avec douceur', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await fillAboutYou(user, { age: '30', height: '1,75', weight: '70', sex: 'Autre' });
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.getByText(/entre 100 et 250 cm/)).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Faisons connaissance' })).toBeVisible();
  });

  it('« Passer » jusqu’au bout puis retour arrière', async () => {
    const { user } = renderScreen(<OnboardingPage />, { profile: undefined, status: 'none' });
    await fillAboutYou(user, { age: '30', height: '170', weight: '65', sex: 'Autre' });
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    await user.click(screen.getByRole('button', { name: 'Passer' }));
    expect(await screen.findByRole('heading', { name: 'Ton organisation' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Passer' })).toBeNull();
    expect(screen.getByRole('radio', { name: /Simple/, checked: true })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retour' }));
    expect(await screen.findByRole('heading', { name: 'Tes goûts' })).toBeVisible();
  });
});
