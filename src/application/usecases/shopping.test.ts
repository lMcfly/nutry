import { describe, expect, it } from 'vitest';
import { createInMemoryPorts } from '../testing';
import { createUseCases } from '.';
import type { ShoppingResult, ShoppingView } from '.';
import { FIXTURE_RECIPES, makeProfile } from '@domain/testing/fixtures';

const setup = async (withProfile = true, shareResult: 'shared' | 'copied' = 'shared') => {
  const ports = createInMemoryPorts({ recipes: FIXTURE_RECIPES, shareResult });
  const uc = createUseCases(ports);
  if (withProfile) await uc.saveProfile(makeProfile());
  return { ports, uc };
};

function ready(result: ShoppingResult): ShoppingView {
  if (result.status !== 'ready') throw new Error('liste attendue');
  return result;
}

const items = (view: ShoppingView) => view.list.sections.flatMap((s) => s.items);

describe('liste de courses', () => {
  it('demande un profil d’abord', async () => {
    const { uc, ports } = await setup(false);
    await expect(uc.getShoppingList()).resolves.toEqual({ status: 'no-profile' });
    await expect(uc.toggleShoppingItem('x')).resolves.toEqual({ status: 'no-profile' });
    await expect(uc.shareShoppingList()).resolves.toBe('failed');
    expect(ports.sharer.shared).toEqual([]);
  });

  it('est construite depuis le menu de la semaine (généré au besoin)', async () => {
    const { uc, ports } = await setup();
    const view = ready(await uc.getShoppingList());
    expect(view.weekStart).toBe('2026-11-23');
    expect(view.reset).toBe(false);
    expect(items(view).length).toBeGreaterThan(5);
    expect(ports.state.plans.size).toBe(1);
  });

  it('coche, ajoute et retire des articles, de façon persistante', async () => {
    const { uc } = await setup();
    const first = items(ready(await uc.getShoppingList()))[0];
    if (!first) throw new Error('article attendu');
    await uc.toggleShoppingItem(first.key);
    let view = ready(await uc.addShoppingItem({ label: '  Café  ', aisle: 'epicerie' }));
    view = ready(await uc.addShoppingItem({ label: 'Éponges' }));
    view = ready(await uc.addShoppingItem({ label: '   ' }));
    const manual = items(view).filter((i) => i.manual);
    expect(manual.map((i) => i.name).sort()).toEqual(['Café', 'Éponges']);
    expect(items(view).find((i) => i.key === first.key)?.checked).toBe(true);

    const coffee = manual.find((i) => i.name === 'Café');
    if (!coffee) throw new Error('café attendu');
    await uc.toggleShoppingItem(coffee.key);
    view = ready(await uc.removeShoppingItem(coffee.key.replace('manuel:', '')));
    expect(items(view).some((i) => i.name === 'Café')).toBe(false);

    view = ready(await uc.uncheckAllShoppingItems());
    expect(items(view).every((i) => !i.checked)).toBe(true);
  });

  it('remet les coches à zéro si le menu change, en gardant les articles manuels', async () => {
    const { uc } = await setup();
    const first = items(ready(await uc.getShoppingList()))[0];
    if (!first) throw new Error('article attendu');
    await uc.toggleShoppingItem(first.key);
    const withManual = ready(await uc.addShoppingItem({ label: 'Café' }));
    const coffee = items(withManual).find((i) => i.manual);
    if (!coffee) throw new Error('café attendu');
    await uc.toggleShoppingItem(coffee.key);

    await uc.generateWeeklyPlan();
    const view = ready(await uc.getShoppingList());
    expect(view.reset).toBe(true);
    expect(
      items(view)
        .filter((i) => i.checked)
        .map((i) => i.key),
    ).toEqual([coffee.key]);
    expect(ready(await uc.getShoppingList()).reset).toBe(false);
  });

  it('suit la taille du foyer', async () => {
    const { uc } = await setup();
    const solo = items(ready(await uc.getShoppingList()));
    await uc.saveProfile(makeProfile({ householdSize: 3 }));
    const family = items(ready(await uc.getShoppingList()));
    const pick = (list: typeof solo) =>
      list.find((i) => i.quantity !== undefined && i.quantity > 1);
    const item = pick(solo);
    if (!item) throw new Error('article chiffré attendu');
    expect(family.find((i) => i.key === item.key)?.quantity).toBeGreaterThan(item.quantity ?? 0);
  });

  it('partage le texte des articles restant à acheter', async () => {
    const { uc, ports } = await setup(true, 'copied');
    await expect(uc.shareShoppingList()).resolves.toBe('copied');
    expect(ports.sharer.shared[0]).toMatch(/^Ma liste de courses Nutry/);
  });
});
