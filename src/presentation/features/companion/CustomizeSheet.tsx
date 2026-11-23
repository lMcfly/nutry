import { useEffect, useState } from 'react';
import type { CompanionView } from '@application/usecases';
import {
  ACCESSORY_SLOTS,
  ACCESSORY_SLOT_LABELS,
  COMPANION_ACCESSORIES,
  COMPANION_COLORS,
  COMPANION_EYES,
} from '@domain/companion';
import type {
  AccessoryId,
  AccessorySlot,
  Accessory,
  CompanionAccessories,
  CompanionItem,
  CompanionLook,
} from '@domain/companion';
import { useDependencies } from '../../app/dependencies';
import { Button } from '../../components/Button';
import { SegmentedTabs } from '../../components/SegmentedTabs';
import { panelId, tabId } from '../../components/tabIds';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { plural } from '../../i18n/labels';
import { Nutry } from './Nutry';
import styles from './CustomizeSheet.module.css';
import { LockIcon } from '../../components/icons';

type CustomizeTab = 'couleur' | 'yeux' | 'accessoires';

const TABS = [
  { id: 'couleur', label: 'Couleur' },
  { id: 'yeux', label: 'Yeux' },
  { id: 'accessoires', label: 'Accessoires' },
] as const;

interface CustomizeSheetProps {
  readonly open: boolean;
  readonly companion: CompanionView;
  readonly onClose: () => void;
  readonly onSaved: (companion: CompanionView) => void;
}

interface ChoiceProps {
  readonly item: CompanionItem;
  readonly selected: boolean;
  readonly unlocked: boolean;
  readonly onPick: () => void;
}

/** Une pastille de choix : grisée avec un cadenas tant que l'élément n'est pas débloqué. */
function Choice({ item, selected, unlocked, onPick }: ChoiceProps) {
  return (
    <li>
      <button
        type="button"
        className={`${styles.choice} ${selected ? styles.selected : ''} ${unlocked ? '' : styles.locked}`}
        aria-pressed={selected}
        aria-disabled={!unlocked}
        onClick={() => {
          if (unlocked) onPick();
        }}
      >
        <span className={styles.choiceEmoji} aria-hidden="true">
          {unlocked ? item.emoji : <LockIcon size={20} />}
        </span>
        <span className={styles.choiceLabel}>{item.label}</span>
        {!unlocked && (
          <span className={styles.lockHint}>à {plural(item.unlockAt, 'jour')} de série</span>
        )}
      </button>
    </li>
  );
}

/** Feuille plein écran « Personnaliser Nutry » : aperçu vivant + onglets, `customizeCompanion`. */
export function CustomizeSheet({ open, companion, onClose, onSaved }: CustomizeSheetProps) {
  const { customizeCompanion } = useDependencies();
  const toast = useToast();
  const [look, setLook] = useState<CompanionLook>(companion.look);
  const [tab, setTab] = useState<CustomizeTab>('couleur');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLook(companion.look);
      setTab('couleur');
    }
  }, [open, companion.look]);

  const unlockedIds = new Set(companion.unlocked.map((item) => item.id));
  const isUnlocked = (item: CompanionItem) => unlockedIds.has(item.id);

  const setAccessory = (slot: AccessorySlot, item: Accessory | undefined) => {
    const next: Partial<Record<AccessorySlot, AccessoryId>> = {};
    for (const s of ACCESSORY_SLOTS) {
      const id = s === slot ? item?.id : look.accessories[s];
      if (id !== undefined) next[s] = id;
    }
    setLook({ ...look, accessories: next as CompanionAccessories });
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await customizeCompanion(look);
      if (result.status === 'saved') {
        onSaved(result.companion);
        toast.show('Nutry a changé de look !', 'success');
        onClose();
      } else {
        toast.show(result.message, 'error');
      }
    } catch {
      toast.show('Oups, ça n’a pas fonctionné. Réessaie.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      variant="full"
      title="Personnaliser Nutry"
      onClose={onClose}
      footer={
        <Button
          block
          disabled={saving}
          onClick={() => {
            void save();
          }}
        >
          Enregistrer ce look
        </Button>
      }
    >
      <div className={styles.layout}>
        <div className={styles.preview}>
          <Nutry look={look} mood={companion.mood} size="l" />
        </div>
        <SegmentedTabs
          label="Ce que tu peux changer"
          tabs={TABS}
          value={tab}
          onChange={setTab}
          idPrefix="nutry"
        />
        <div
          role="tabpanel"
          id={panelId('nutry', tab)}
          aria-labelledby={tabId('nutry', tab)}
          className={styles.panel}
        >
          {tab === 'couleur' && (
            <ul className={styles.grid} aria-label="Couleurs">
              {COMPANION_COLORS.map((item) => (
                <Choice
                  key={item.id}
                  item={item}
                  selected={look.color === item.id}
                  unlocked={isUnlocked(item)}
                  onPick={() => {
                    setLook({ ...look, color: item.id });
                  }}
                />
              ))}
            </ul>
          )}
          {tab === 'yeux' && (
            <ul className={styles.grid} aria-label="Yeux">
              {COMPANION_EYES.map((item) => (
                <Choice
                  key={item.id}
                  item={item}
                  selected={look.eyes === item.id}
                  unlocked={isUnlocked(item)}
                  onPick={() => {
                    setLook({ ...look, eyes: item.id });
                  }}
                />
              ))}
            </ul>
          )}
          {tab === 'accessoires' &&
            ACCESSORY_SLOTS.map((slot) => {
              const items = COMPANION_ACCESSORIES.filter((a) => a.slot === slot);
              const worn = look.accessories[slot];
              return (
                <section key={slot} aria-label={ACCESSORY_SLOT_LABELS[slot]}>
                  <h3 className={styles.slotTitle}>{ACCESSORY_SLOT_LABELS[slot]}</h3>
                  <ul className={styles.grid}>
                    <li>
                      <button
                        type="button"
                        className={`${styles.choice} ${worn === undefined ? styles.selected : ''}`}
                        aria-pressed={worn === undefined}
                        onClick={() => {
                          setAccessory(slot, undefined);
                        }}
                      >
                        <span className={styles.choiceEmoji} aria-hidden="true">
                          ∅
                        </span>
                        <span className={styles.choiceLabel}>Aucun</span>
                      </button>
                    </li>
                    {items.map((item) => (
                      <Choice
                        key={item.id}
                        item={item}
                        selected={worn === item.id}
                        unlocked={isUnlocked(item)}
                        onPick={() => {
                          setAccessory(slot, item);
                        }}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
        </div>
      </div>
    </Sheet>
  );
}
