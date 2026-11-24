import { useCallback, useEffect, useRef, useState } from 'react';
import { MANUAL_ITEM_MAX_LENGTH } from '@application/usecases';
import type { ShoppingResult, ShoppingView } from '@application/usecases';
import { AISLES } from '@domain/recipe';
import type { Aisle } from '@domain/recipe';
import type { ShoppingItem } from '@domain/shopping';
import { formatIngredient, formatIngredientText, ingredientEmoji } from '@domain/shopping';
import { useDependencies } from '../app/dependencies';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import {
  BasketIcon,
  CheckIcon,
  ChevronDownIcon,
  MoreIcon,
  PlusIcon,
  RecycleIcon,
  ShareIcon,
  TrashIcon,
} from '../components/icons';
import { ListGroup, ListRow } from '../components/ListRow';
import { useMediaQuery } from '../hooks/useMediaQuery';
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
import { AISLE_LABELS, SECTION_EMOJIS, SECTION_SHORT_LABELS, SECTION_TITLES } from '../i18n/labels';
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

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Durée de l'animation « dans le panier » avant que la tuile ne rejoigne la section repliable. */
const LEAVE_MS = 420;

interface TileProps {
  readonly item: ShoppingItem;
  readonly leaving: boolean;
  readonly onToggle: (item: ShoppingItem) => void;
  readonly onRemove: (item: ShoppingItem) => void;
}

/** Tuile d'un article : gros emoji, nom, quantité. La toucher la coche (vraie case à cocher). */
function ShoppingTile({ item, leaving, onToggle, onRemove }: TileProps) {
  const parts = itemParts(item);
  const name = capitalize(parts.name);
  const accessibleName = parts.amount === undefined ? name : `${name}, ${parts.amount}`;
  const emoji = ingredientEmoji(item.name) ?? SECTION_EMOJIS[item.section];
  return (
    <li
      className={`${styles.tile} ${item.checked ? styles.checked : ''} ${leaving ? styles.leaving : ''}`}
    >
      <label className={styles.tileLabel}>
        <input
          type="checkbox"
          className={styles.tileBox}
          checked={item.checked}
          aria-label={accessibleName}
          onChange={() => {
            onToggle(item);
          }}
        />
        <span className={styles.emoji} aria-hidden="true">
          {emoji}
        </span>
        <span className={styles.tileName} aria-hidden="true">
          {name}
        </span>
        {parts.amount !== undefined && (
          <span className={styles.tileQty} aria-hidden="true">
            {parts.amount}
          </span>
        )}
        <span className={styles.tick} aria-hidden="true">
          <CheckIcon size={14} />
        </span>
      </label>
      {item.manual && (
        <button
          type="button"
          className={styles.remove}
          aria-label={`Supprimer ${itemText(item)}`}
          onClick={() => {
            onRemove(item);
          }}
        >
          <TrashIcon size={16} />
        </button>
      )}
    </li>
  );
}

/** Anneau de progression, sans pourcentage : le chiffre « 12 / 57 » est à côté. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const ratio = total === 0 ? 0 : done / total;
  return (
    <svg className={styles.ring} viewBox="0 0 36 36" aria-hidden="true" focusable="false">
      <circle cx="18" cy="18" r={radius} className={styles.ringTrack} />
      <circle
        cx="18"
        cy="18"
        r={radius}
        className={styles.ringValue}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        transform="rotate(-90 18 18)"
      />
      <text
        x="18"
        y="18"
        textAnchor="middle"
        dominantBaseline="central"
        className={styles.ringIcon}
      >
        🧺
      </text>
    </svg>
  );
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
  const [basketOpen, setBasketOpen] = useState(false);
  /** Articles qui viennent d'être cochés : ils jouent leur animation avant de rejoindre le panier. */
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const leaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  useEffect(() => {
    const timers = leaveTimers.current;
    return () => {
      timers.forEach((timer) => {
        clearTimeout(timer);
      });
    };
  }, []);
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

  const toggleItem = (item: ShoppingItem) => {
    const checking = !item.checked;
    toggleOptimistically(item.key);
    if (checking && !reducedMotion) {
      setLeaving((set) => new Set(set).add(item.key));
      leaveTimers.current.set(
        item.key,
        setTimeout(() => {
          leaveTimers.current.delete(item.key);
          setLeaving((set) => {
            const next = new Set(set);
            next.delete(item.key);
            return next;
          });
        }, LEAVE_MS),
      );
    }
    void apply(toggleShoppingItem(item.key)).then(() => {
      if (checking) checkCelebration();
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
  const toBuy = active?.items.filter((i) => !i.checked || leaving.has(i.key)) ?? [];
  const inRayonBasket = active?.items.filter((i) => i.checked && !leaving.has(i.key)) ?? [];
  const removeItem = (item: ShoppingItem) => {
    void apply(removeShoppingItem(item.key.replace(/^manuel:/, '')));
  };

  return (
    <Page
      title="Mes courses"
      subtitle={view ? undefined : 'Rangées par rayon'}
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
            <div className={styles.progress}>
              <ProgressRing done={inBasket} total={items.length} />
              <p className={styles.progressText}>
                {items.length > 0 && inBasket === items.length ? (
                  'Tout est dans le panier, bravo !'
                ) : (
                  <>
                    <strong>
                      {inBasket} / {items.length}
                    </strong>{' '}
                    <span>dans le panier</span>
                  </>
                )}
              </p>
            </div>
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
                        <span aria-hidden="true">{SECTION_EMOJIS[section.key]}</span>
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
                  <h2 id={`rayon-${active.key}`} className="visually-hidden">
                    {SECTION_TITLES[active.key]}
                  </h2>
                  <ScrollArea
                    label={`Articles : ${SECTION_TITLES[active.key]}`}
                    className={styles.scroll}
                  >
                    {toBuy.length > 0 ? (
                      <ul className={styles.grid}>
                        {toBuy.map((item) => (
                          <ShoppingTile
                            key={item.key}
                            item={item}
                            leaving={leaving.has(item.key)}
                            onToggle={toggleItem}
                            onRemove={removeItem}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.allDone}>
                        <span aria-hidden="true">🎉</span> Tout est dans le panier pour ce rayon.
                      </p>
                    )}
                    {inRayonBasket.length > 0 && (
                      <section className={styles.basket}>
                        <h3 className={styles.basketTitle}>
                          <button
                            type="button"
                            className={styles.basketToggle}
                            aria-expanded={basketOpen}
                            aria-controls="panier-liste"
                            onClick={() => {
                              setBasketOpen((open) => !open);
                            }}
                          >
                            Dans le panier ({inRayonBasket.length})
                            <ChevronDownIcon size={18} className={styles.chevron} />
                          </button>
                        </h3>
                        <ul id="panier-liste" className={styles.grid} hidden={!basketOpen}>
                          {inRayonBasket.map((item) => (
                            <ShoppingTile
                              key={item.key}
                              item={item}
                              leaving={false}
                              onToggle={toggleItem}
                              onRemove={removeItem}
                            />
                          ))}
                        </ul>
                      </section>
                    )}
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
