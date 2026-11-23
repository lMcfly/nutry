import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShoppingPage } from './ShoppingPage';
import { renderScreen } from '../testing/renderApp';

const record = (ports: ReturnType<typeof renderScreen>['ports']) =>
  [...ports.state.shopping.values()][0];

describe('<ShoppingPage />', () => {
  it('groupe par rayon dans l’ordre du magasin', async () => {
    renderScreen(<ShoppingPage />);
    await screen.findByRole('heading', { name: /Fruits et légumes/ });
    const titles = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
      .filter((t) => !t.includes('Ajouter'));
    expect(titles[0]).toMatch(/Fruits et légumes/);
    expect(titles.findIndex((t) => t.includes('Épicerie'))).toBeGreaterThan(0);
  });

  it('coche un article, ajoute et supprime un article manuel, décoche tout', async () => {
    const { user, ports } = renderScreen(<ShoppingPage />);
    const section = (await screen.findByRole('heading', { name: /Fruits et légumes/ })).closest(
      'section',
    );
    if (!section) throw new Error('section introuvable');
    const first = within(section).getAllByRole('checkbox')[0];
    if (!first) throw new Error('aucun article');
    await user.click(first);
    await waitFor(() => {
      expect(first).toBeChecked();
    });
    expect(record(ports)?.state.checkedKeys).toHaveLength(1);

    await user.type(screen.getByLabelText('Article'), 'Café moulu');
    await user.selectOptions(screen.getByLabelText('Rayon'), 'epicerie');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('checkbox', { name: 'Café moulu' })).toBeInTheDocument();
    expect(record(ports)?.state.manualItems[0]).toMatchObject({
      label: 'Café moulu',
      aisle: 'epicerie',
    });

    await user.click(screen.getByRole('button', { name: 'Tout décocher' }));
    await waitFor(() => {
      expect(first).not.toBeChecked();
    });

    await user.click(screen.getByRole('button', { name: 'Supprimer Café moulu' }));
    await waitFor(() => {
      expect(screen.queryByRole('checkbox', { name: 'Café moulu' })).toBeNull();
    });
  });

  it('partage, sinon copie avec un message', async () => {
    const { user, ports } = renderScreen(<ShoppingPage />, { shareResult: 'copied' });
    await user.click(await screen.findByRole('button', { name: /Partager/ }));
    expect(await screen.findByText(/Liste copiée/)).toBeInTheDocument();
    expect(ports.sharer.shared[0]).toMatch(/Ma liste de courses Nutry/);
  });
});
