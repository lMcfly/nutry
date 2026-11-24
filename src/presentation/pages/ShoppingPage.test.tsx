import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShoppingPage } from './ShoppingPage';
import { renderScreen } from '../testing/renderApp';

/** Ouvre le menu « ⋯ » de la liste puis choisit une ligne (Partager, Tout décocher). */
async function fromMenu(user: ReturnType<typeof renderScreen>['user'], name: string | RegExp) {
  await user.click(await screen.findByRole('button', { name: 'Plus d’options' }));
  const menu = await screen.findByRole('dialog', { name: 'Ma liste' });
  await user.click(within(menu).getByRole('button', { name }));
}

const record = (ports: ReturnType<typeof renderScreen>['ports']) =>
  [...ports.state.shopping.values()][0];

describe('<ShoppingPage />', () => {
  it('un onglet par rayon, dans l’ordre du magasin, avec le compteur à acheter', async () => {
    const { user } = renderScreen(<ShoppingPage />);
    const tabs = await screen.findAllByRole('tab');
    expect(tabs[0]).toHaveAccessibleName(/^Fruits et légumes, \d+ à acheter sur \d+/);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    const epicerie = tabs.findIndex((t) => t.getAttribute('aria-label')?.startsWith('Épicerie'));
    expect(epicerie).toBeGreaterThan(0);
    // Un seul rayon à l'écran : la liste du rayon actif, dans sa carte.
    expect(screen.getByRole('heading', { level: 2, name: /Fruits et légumes/ })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 2, name: /Épicerie/ })).toBeNull();
    await user.click(tabs[epicerie] as HTMLElement);
    expect(screen.getByRole('heading', { level: 2, name: /Épicerie/ })).toBeVisible();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', tabs[epicerie]?.id);
  });

  it('affiche « n / total » dans le panier et le met à jour', async () => {
    const { user } = renderScreen(<ShoppingPage />);
    expect(await screen.findByText(/^0 \/ \d+$/)).toBeVisible();
    const list = screen.getByTestId('shopping-list');
    const first = within(list).getAllByRole('checkbox')[0];
    if (!first) throw new Error('aucun article');
    await user.click(first);
    expect(await screen.findByText(/^1 \/ \d+$/)).toBeVisible();
  });

  it('les tuiles portent un emoji, le nom et la quantité dans le nom accessible', async () => {
    renderScreen(<ShoppingPage />);
    const list = await screen.findByTestId('shopping-list');
    const boxes = within(list).getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(2);
    // « Nom, quantité » ou « 2 concombres » d'un bloc, initiale en capitale.
    for (const box of boxes) expect(box.getAttribute('aria-label')).toMatch(/^[A-ZÉÈÂÊ0-9]/);
    expect(within(list).getAllByText(/\p{Extended_Pictographic}/u).length).toBeGreaterThan(2);
  });

  it('cocher une tuile l’envoie dans « Dans le panier (n) », repliable ; la décocher la rend', async () => {
    const { user, ports } = renderScreen(<ShoppingPage />);
    const list = await screen.findByTestId('shopping-list');
    const first = within(list).getAllByRole('checkbox')[0];
    if (!first) throw new Error('aucun article');
    const name = first.getAttribute('aria-label') ?? '';
    await user.click(first);
    const toggle = await screen.findByRole('button', { name: 'Dans le panier (1)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => {
      expect(record(ports)?.state.checkedKeys).toHaveLength(1);
    });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const inBasket = await within(list).findByRole('checkbox', { name, checked: true });
    await user.click(inBasket);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Dans le panier/ })).toBeNull();
    });
    expect(within(list).getByRole('checkbox', { name, checked: false })).toBeInTheDocument();
  });

  it('ajoute et supprime un article manuel, décoche tout', async () => {
    const { user, ports } = renderScreen(<ShoppingPage />);
    const list = await screen.findByTestId('shopping-list');
    const first = within(list).getAllByRole('checkbox')[0];
    if (!first) throw new Error('aucun article');
    await user.click(first);
    await waitFor(() => {
      expect(record(ports)?.state.checkedKeys).toHaveLength(1);
    });

    // Ajout manuel dans une feuille.
    await user.click(screen.getByRole('button', { name: 'Ajouter un article' }));
    const sheet = await screen.findByRole('dialog', { name: 'Ajouter un article' });
    await user.type(within(sheet).getByLabelText('Article'), 'Café moulu');
    await user.selectOptions(within(sheet).getByLabelText('Rayon'), 'epicerie');
    await user.click(within(sheet).getByRole('button', { name: 'Ajouter' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(record(ports)?.state.manualItems[0]).toMatchObject({
      label: 'Café moulu',
      aisle: 'epicerie',
    });
    await user.click(await screen.findByRole('tab', { name: /^Épicerie/ }));
    expect(await screen.findByRole('checkbox', { name: 'Café moulu' })).toBeInTheDocument();

    await fromMenu(user, 'Tout décocher');
    await waitFor(() => {
      expect(record(ports)?.state.checkedKeys).toHaveLength(0);
    });
    await user.click(screen.getByRole('tab', { name: /^Fruits et légumes/ }));
    expect(screen.queryByRole('button', { name: /Dans le panier/ })).toBeNull();

    await user.click(screen.getByRole('tab', { name: /^Épicerie/ }));
    await user.click(screen.getByRole('button', { name: 'Supprimer Café moulu' }));
    await waitFor(() => {
      expect(screen.queryByRole('checkbox', { name: 'Café moulu' })).toBeNull();
    });
  });

  it('partage, sinon copie avec un message', async () => {
    const { user, ports } = renderScreen(<ShoppingPage />, { shareResult: 'copied' });
    await fromMenu(user, /Partager/);
    expect(await screen.findByText(/Liste copiée/)).toBeInTheDocument();
    expect(ports.sharer.shared[0]).toMatch(/Ma liste de courses Nutry/);
  });

  it('partage annulé : aucun message d’erreur', async () => {
    const { user, ports } = renderScreen(<ShoppingPage />, { shareResult: 'cancelled' });
    await fromMenu(user, /Partager/);
    await waitFor(() => {
      expect(ports.sharer.shared).toHaveLength(1);
    });
    expect(screen.queryByText(/partage n’a pas fonctionné/)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('partage impossible : message d’erreur', async () => {
    const { user } = renderScreen(<ShoppingPage />, { shareResult: 'failed' });
    await fromMenu(user, /Partager/);
    expect(await screen.findByText(/partage n’a pas fonctionné/)).toBeInTheDocument();
  });
});
