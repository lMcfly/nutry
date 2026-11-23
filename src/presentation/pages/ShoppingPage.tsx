import { useCallback, useState } from 'react';
import { MANUAL_ITEM_MAX_LENGTH } from '@application/usecases';
import type { ShoppingResult, ShoppingView } from '@application/usecases';
import { AISLES } from '@domain/recipe';
import type { Aisle } from '@domain/recipe';
import type { ShoppingItem } from '@domain/shopping';
import { formatIngredient, formatIngredientText } from '@domain/shopping';
import { useDependencies } from '../app/dependencies';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Field, SelectField } from '../components/Field';
import { Notice } from '../components/Notice';
import { Page } from '../components/Page';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { AISLE_LABELS, SECTION_EMOJIS, SECTION_TITLES } from '../i18n/labels';
import styles from './ShoppingPage.module.css';

function itemText(item: ShoppingItem): string {
  return item.quantity !== undefined && item.unit !== undefined
    ? formatIngredientText(item.name, item.quantity, item.unit)
    : item.name;
}

/** Nom et quantité affichés : « 2 concombres » d'un bloc, sinon « ail … 7 gousses ». */
function itemParts(item: ShoppingItem): { name: string; amount?: string } {
  if (item.quantity === undefined || item.unit === undefined) return { name: item.name };
  const shown = formatIngredient(item.name, item.quantity, item.unit);
  return shown.amountFirst
    ? { name: `${shown.amount} ${shown.label}` }
    : { name: shown.label, amount: shown.amount };
}

export function ShoppingPage() {
  const {
    getShoppingList,
    toggleShoppingItem,
    addShoppingItem,
    removeShoppingItem,
    uncheckAllShoppingItems,
    shareShoppingList,
  } = useDependencies();
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [aisle, setAisle] = useState<Aisle | ''>('');
  const [resetSeen, setResetSeen] = useState(false);
  /** Écritures en cours : la liste est annoncée « occupée » tant qu'elles ne sont pas enregistrées. */
  const [pending, setPending] = useState(0);

  const load = useCallback(() => getShoppingList(), [getShoppingList]);
  const { state, setData } = useAsync<ShoppingResult>(load);

  const apply = async (action: Promise<ShoppingResult>) => {
    setPending((n) => n + 1);
    try {
      setData(await action);
    } catch {
      toast.show('Oups, ça n’a pas fonctionné. Réessaie.', 'error');
    } finally {
      setPending((n) => n - 1);
    }
  };

  /** La case réagit tout de suite ; la réponse du cas d'usage fait foi ensuite. */
  const toggleOptimistically = (key: string) => {
    if (state.status !== 'ready' || state.data.status !== 'ready') return;
    const current = state.data;
    setData({
      ...current,
      list: {
        sections: current.list.sections.map((section) => ({
          ...section,
          items: section.items.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i)),
        })),
      },
    });
  };

  const share = async () => {
    const result = await shareShoppingList();
    // `shared` : la feuille de partage suffit ; `cancelled` : la personne a renoncé, rien à dire.
    if (result === 'copied') toast.show('Liste copiée : colle-la où tu veux.', 'success');
    else if (result === 'failed') toast.show('Le partage n’a pas fonctionné.', 'error');
  };

  const view: ShoppingView | undefined =
    state.status === 'ready' && state.data.status === 'ready' ? state.data : undefined;
  const items = view?.list.sections.flatMap((s) => s.items) ?? [];
  const remaining = items.filter((i) => !i.checked).length;
  const anyChecked = items.some((i) => i.checked);

  return (
    <Page
      title="Mes courses"
      subtitle={
        view
          ? remaining === 0 && items.length > 0
            ? 'Tout est dans le panier, bravo !'
            : `${remaining} article${remaining > 1 ? 's' : ''} à acheter`
          : 'Rangées par rayon'
      }
    >
      {view && (
        <div className={styles.toolbar}>
          <Button
            small
            icon="📤"
            onClick={() => {
              void share();
            }}
          >
            Partager
          </Button>
          <Button
            small
            variant="secondary"
            disabled={!anyChecked}
            onClick={() => {
              void apply(uncheckAllShoppingItems());
            }}
          >
            Tout décocher
          </Button>
        </div>
      )}

      {view?.reset && !resetSeen && (
        <Notice
          tone="info"
          emoji="🔄"
          live
          onDismiss={() => {
            setResetSeen(true);
          }}
        >
          Ton menu a changé : j’ai décoché les ingrédients. Tes ajouts sont toujours là.
        </Notice>
      )}

      {state.status === 'loading' && <p role="status">Un instant…</p>}
      {state.status === 'ready' && !view && (
        <EmptyState emoji="🧺" title="Pas encore de liste">
          Ta liste se remplit toute seule avec ton menu.
        </EmptyState>
      )}

      <div data-testid="shopping-list" aria-busy={pending > 0}>
        {view?.list.sections.map((section) => (
          <Card as="section" key={section.key} aria-labelledby={`rayon-${section.key}`}>
            <h2 id={`rayon-${section.key}`} className={styles.sectionTitle}>
              <span aria-hidden="true">{SECTION_EMOJIS[section.key]} </span>
              {SECTION_TITLES[section.key]}
            </h2>
            <ul className={styles.items}>
              {section.items.map((item) => (
                <li key={item.key} className={styles.item}>
                  <label className={`${styles.check} ${item.checked ? styles.checked : ''}`}>
                    <input
                      type="checkbox"
                      className={styles.box}
                      checked={item.checked}
                      onChange={() => {
                        toggleOptimistically(item.key);
                        void apply(toggleShoppingItem(item.key));
                      }}
                    />
                    <span className={styles.name}>{itemParts(item).name}</span>
                    {itemParts(item).amount !== undefined && (
                      <span className={styles.qty}>{itemParts(item).amount}</span>
                    )}
                  </label>
                  {item.manual && (
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`Supprimer ${itemText(item)}`}
                      onClick={() => {
                        void apply(removeShoppingItem(item.key.replace(/^manuel:/, '')));
                      }}
                    >
                      🗑
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {view && (
        <Card as="section" tone="sunken" aria-labelledby="ajout-title">
          <h2 id="ajout-title" className={styles.sectionTitle}>
            <span aria-hidden="true">➕ </span>Ajouter un article
          </h2>
          <form
            className={styles.addForm}
            onSubmit={(event) => {
              event.preventDefault();
              const text = label.trim();
              if (!text) return;
              void apply(addShoppingItem({ label: text, ...(aisle === '' ? {} : { aisle }) })).then(
                () => {
                  toast.show(`« ${text} » ajouté.`, 'success');
                },
              );
              setLabel('');
            }}
          >
            <Field
              label="Article"
              placeholder="Ex. café, éponges…"
              value={label}
              maxLength={MANUAL_ITEM_MAX_LENGTH}
              onChange={(e) => {
                setLabel(e.target.value);
              }}
            />
            <SelectField
              label="Rayon"
              value={aisle}
              onChange={(e) => {
                setAisle(e.target.value as Aisle | '');
              }}
            >
              <option value="">Divers</option>
              {AISLES.map((a) => (
                <option key={a} value={a}>
                  {AISLE_LABELS[a]}
                </option>
              ))}
            </SelectField>
            <Button type="submit" disabled={label.trim() === ''}>
              Ajouter
            </Button>
          </form>
        </Card>
      )}
    </Page>
  );
}
