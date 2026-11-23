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
import {
  BasketIcon,
  CheckIcon,
  MoreIcon,
  PlusIcon,
  RecycleIcon,
  ShareIcon,
  TrashIcon,
} from '../components/icons';
import { ListGroup, ListRow } from '../components/ListRow';
import { EmptyState } from '../components/EmptyState';
import { Field, SelectField } from '../components/Field';
import { Notice } from '../components/Notice';
import { Page } from '../components/Page';
import { RoundIconButton } from '../components/RoundIconButton';
import { ScrollArea } from '../components/ScrollArea';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { panelId, tabId } from '../components/tabIds';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/Toast';
import { useCelebrationCheck } from '../features/companion/Celebration';
import { useAsync } from '../hooks/useAsync';
import { AISLE_LABELS, SECTION_SHORT_LABELS, SECTION_TITLES } from '../i18n/labels';
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
  const checkCelebration = useCelebrationCheck();
  const [label, setLabel] = useState('');
  const [aisle, setAisle] = useState<Aisle | ''>('');
  const [resetSeen, setResetSeen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [activeKey, setActiveKey] = useState<string | undefined>();
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
  const sections = view?.list.sections ?? [];
  const items = sections.flatMap((s) => s.items);
  const inBasket = items.filter((i) => i.checked).length;
  const anyChecked = inBasket > 0;
  const active = sections.find((s) => s.key === activeKey) ?? sections[0];

  return (
    <Page
      title="Mes courses"
      subtitle={
        view
          ? items.length > 0 && inBasket === items.length
            ? 'Tout est dans le panier, bravo !'
            : `${inBasket} sur ${items.length}`
          : 'Rangées par rayon'
      }
      actions={
        view && (
          <RoundIconButton
            icon={<MoreIcon />}
            label="Plus d’options"
            onClick={() => {
              setMenu(true);
            }}
          />
        )
      }
    >
      <div className={styles.root}>
        {view?.reset && !resetSeen && (
          <Notice
            tone="info"
            emoji={<RecycleIcon size={20} />}
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
          <EmptyState emoji={<BasketIcon size={28} />} title="Pas encore de liste">
            Ta liste se remplit toute seule avec ton menu.
          </EmptyState>
        )}

        {view && active && (
          <>
            <div className={styles.layout}>
              <SegmentedTabs
                idPrefix="rayon"
                className={styles.rayons}
                label="Rayons"
                variant="chips"
                value={active.key}
                onChange={setActiveKey}
                tabs={sections.map((section) => {
                  const left = section.items.filter((i) => !i.checked).length;
                  return {
                    id: section.key,
                    ariaLabel: `${SECTION_SHORT_LABELS[section.key]}, ${left} à acheter sur ${section.items.length}`,
                    label: (
                      <>
                        {SECTION_SHORT_LABELS[section.key]}
                        <span className={styles.count} aria-hidden="true">
                          {left}
                        </span>
                      </>
                    ),
                  };
                })}
              />
              <div
                data-testid="shopping-list"
                aria-busy={pending > 0}
                className={styles.panel}
                role="tabpanel"
                id={panelId('rayon', active.key)}
                aria-labelledby={tabId('rayon', active.key)}
              >
                <Card as="section" className={styles.card} aria-labelledby={`rayon-${active.key}`}>
                  <h2 id={`rayon-${active.key}`} className={styles.sectionTitle}>
                    {SECTION_TITLES[active.key]}
                  </h2>
                  <ScrollArea
                    label={`Articles : ${SECTION_TITLES[active.key]}`}
                    className={styles.scroll}
                  >
                    <ul className={styles.items}>
                      {active.items.map((item) => (
                        <li key={item.key} className={styles.item}>
                          <label
                            className={`${styles.check} ${item.checked ? styles.checked : ''}`}
                          >
                            <input
                              type="checkbox"
                              className={styles.box}
                              checked={item.checked}
                              onChange={() => {
                                const checking = !item.checked;
                                toggleOptimistically(item.key);
                                void apply(toggleShoppingItem(item.key)).then(() => {
                                  if (checking) checkCelebration();
                                });
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
                              <TrashIcon size={20} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </Card>
              </div>
            </div>
          </>
        )}

        {view && (
          <RoundIconButton
            className={styles.fab}
            icon={<PlusIcon />}
            label="Ajouter un article"
            tone="primary"
            onClick={() => {
              setAdding(true);
            }}
          />
        )}
      </div>

      <Sheet
        open={menu}
        title="Ma liste"
        onClose={() => {
          setMenu(false);
        }}
      >
        <ListGroup label="Options de la liste">
          <ListRow
            icon={<ShareIcon />}
            title="Partager"
            onClick={() => {
              setMenu(false);
              void share();
            }}
          />
          <ListRow
            icon={<CheckIcon />}
            title="Tout décocher"
            disabled={!anyChecked}
            onClick={() => {
              setMenu(false);
              void apply(uncheckAllShoppingItems());
            }}
          />
        </ListGroup>
      </Sheet>

      <Sheet
        open={adding}
        title="Ajouter un article"
        onClose={() => {
          setAdding(false);
        }}
      >
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
            setAdding(false);
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
      </Sheet>
    </Page>
  );
}
