import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { CompanionView } from '@application/usecases';
import {
  ACCESSORY_SLOTS,
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
import { unlockCondition, unlockHint } from '../../i18n/labels';
import { Nutry } from './Nutry';
import styles from './CustomizeSheet.module.css';
import { LockIcon } from '../../components/icons';

type CustomizeTab = 'couleur' | 'yeux' | 'accessoires' | 'sport';

const HINT = 'Touche une bulle pour l’essayer sur Nutry.';

const TAB_TITLES = {
  couleur: 'Couleurs',
  yeux: 'Yeux',
  accessoires: 'Accessoires',
  sport: 'Accessoires de sport',
} as const;

const TABS = [
  { id: 'couleur', label: 'Couleur' },
  { id: 'yeux', label: 'Yeux' },
  { id: 'accessoires', label: 'Accessoires' },
  { id: 'sport', label: 'Sport' },
] as const;

/** Accessoires de série (le reste du catalogue) et accessoires de sport (séances cumulées). */
const SERIE_ACCESSORIES = COMPANION_ACCESSORIES.filter((a) => a.unlockAt.kind === 'serie');
const SPORT_ACCESSORIES = COMPANION_ACCESSORIES.filter((a) => a.unlockAt.kind === 'seances');

interface CustomizeSheetProps {
  readonly open: boolean;
  readonly companion: CompanionView;
  readonly onClose: () => void;
  readonly onSaved: (companion: CompanionView) => void;
}

interface BubbleProps {
  readonly item: CompanionItem;
  readonly selected: boolean;
  readonly unlocked: boolean;
  readonly index: number;
  readonly count: number;
  readonly onPick: () => void;
}

/**
 * Bulle ronde posée sur le cercle autour de Nutry : grisée, avec un cadenas et « à X jours »,
 * tant que l'élément n'est pas débloqué. Toucher une bulle libre l'essaie tout de suite.
 */
function Bubble({ item, selected, unlocked, index, count, onPick }: BubbleProps) {
  // Départ en haut, sens horaire ; cos et sin sont lus par la CSS (`--cx`, `--cy`).
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  const position = {
    '--cx': Math.cos(angle).toFixed(4),
    '--cy': Math.sin(angle).toFixed(4),
  } as CSSProperties;
  return (
    <li className={styles.slot} style={position}>
      <button
        type="button"
        className={`${styles.bubble} ${selected ? styles.selected : ''} ${unlocked ? '' : styles.locked}`}
        aria-pressed={selected}
        aria-disabled={!unlocked}
        aria-label={unlocked ? item.label : `${item.label}, verrouillé, à ${unlockCondition(item)}`}
        onClick={() => {
          if (unlocked) onPick();
        }}
      >
        {unlocked ? (
          <span className={styles.bubbleEmoji} aria-hidden="true">
            {item.emoji}
          </span>
        ) : (
          <>
            <LockIcon size={18} />
            <span className={styles.lockHint} aria-hidden="true">
              {unlockHint(item)}
            </span>
          </>
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
  const [bounce, setBounce] = useState(0);
  const [caption, setCaption] = useState(HINT);

  useEffect(() => {
    if (open) {
      setLook(companion.look);
      setTab('couleur');
      setCaption(HINT);
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

  const items: readonly CompanionItem[] =
    tab === 'couleur'
      ? COMPANION_COLORS
      : tab === 'yeux'
        ? COMPANION_EYES
        : tab === 'sport'
          ? SPORT_ACCESSORIES
          : SERIE_ACCESSORIES;

  const isSelected = (item: CompanionItem): boolean => {
    if (item.kind === 'color') return look.color === item.id;
    if (item.kind === 'eyes') return look.eyes === item.id;
    return look.accessories[item.slot] === item.id;
  };

  /** Essaie l'élément sur Nutry tout de suite ; un accessoire déjà porté s'enlève. */
  const pick = (item: CompanionItem) => {
    if (item.kind === 'color') setLook({ ...look, color: item.id });
    else if (item.kind === 'eyes') setLook({ ...look, eyes: item.id });
    else setAccessory(item.slot, look.accessories[item.slot] === item.id ? undefined : item);
    setBounce((n) => n + 1);
    setCaption(item.kind === 'accessory' && isSelected(item) ? `${item.label} retiré` : item.label);
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
          <div className={styles.ring}>
            <div className={styles.center}>
              <div key={bounce} className={styles.hop}>
                <Nutry look={look} mood={companion.mood} size="l" />
              </div>
            </div>
            <ul className={styles.bubbles} aria-label={TAB_TITLES[tab]}>
              {items.map((item, index) => (
                <Bubble
                  key={item.id}
                  item={item}
                  index={index}
                  count={items.length}
                  selected={isSelected(item)}
                  unlocked={isUnlocked(item)}
                  onPick={() => {
                    pick(item);
                  }}
                />
              ))}
            </ul>
          </div>
          <p className={styles.caption} aria-live="polite">
            {caption}
          </p>
          {(tab === 'accessoires' || tab === 'sport') && (
            <Button
              variant="ghost"
              small
              onClick={() => {
                setLook({ ...look, accessories: {} });
                setBounce((n) => n + 1);
                setCaption('Aucun accessoire');
              }}
            >
              Aucun accessoire
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
