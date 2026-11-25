import { useId } from 'react';
import type { ReactNode } from 'react';
import styles from './Choice.module.css';

export interface ChoiceOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly emoji?: string;
  /** Phrase d'explication sous le libellé (cartes). */
  readonly hint?: string;
  readonly disabled?: boolean;
}

interface GroupFrameProps {
  readonly legend: ReactNode;
  readonly hint?: ReactNode;
  readonly hideLegend?: boolean | undefined;
  readonly children: ReactNode;
}

function GroupFrame({ legend, hint, hideLegend, children }: GroupFrameProps) {
  return (
    <fieldset className={styles.fieldset}>
      <legend className={hideLegend ? 'visually-hidden' : styles.legend}>{legend}</legend>
      {hint !== undefined && <p className={styles.hint}>{hint}</p>}
      {children}
    </fieldset>
  );
}

interface ChipGroupProps<T extends string> {
  readonly legend: ReactNode;
  readonly hint?: ReactNode;
  readonly hideLegend?: boolean | undefined;
  readonly options: readonly ChoiceOption<T>[];
  readonly selected: readonly T[];
  readonly onChange: (selected: T[]) => void;
}

/**
 * Sélection multiple en puces : de vraies cases à cocher (clavier, lecteurs d'écran),
 * habillées en puces arrondies.
 */
export function ChipGroup<T extends string>({
  legend,
  hint,
  hideLegend,
  options,
  selected,
  onChange,
}: ChipGroupProps<T>) {
  const toggle = (value: T) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };
  return (
    <GroupFrame legend={legend} hint={hint} hideLegend={hideLegend}>
      <div className={styles.chips}>
        {options.map((option) => (
          <label
            key={option.value}
            className={`${styles.chip} ${styles.cloudChip} ${option.disabled ? styles.disabled : ''}`}
          >
            <input
              type="checkbox"
              className={styles.input}
              checked={selected.includes(option.value)}
              disabled={option.disabled}
              onChange={() => {
                toggle(option.value);
              }}
            />
            {option.emoji !== undefined && (
              <span aria-hidden="true" className={styles.emoji}>
                {option.emoji}
              </span>
            )}
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </GroupFrame>
  );
}

interface RadioGroupProps<T extends string> {
  readonly legend: ReactNode;
  readonly hint?: ReactNode;
  readonly hideLegend?: boolean | undefined;
  readonly options: readonly ChoiceOption<T>[];
  readonly value: T | undefined;
  readonly onChange: (value: T) => void;
  /** `cards` : une option par ligne avec explication ; `chips` : puces en ligne ; `tiles` : grandes cartes illustrées. */
  readonly layout?: 'cards' | 'chips' | 'segmented' | 'tiles';
  readonly name?: string;
  /**
   * Appelé quand la personne touche une option avec la souris ou le doigt (même celle déjà
   * choisie) : l'onboarding passe alors à la question suivante. Jamais au clavier, pour ne
   * pas changer d'écran pendant qu'on parcourt les flèches.
   */
  readonly onPick?: ((value: T) => void) | undefined;
}

/** Choix unique : boutons radio natifs (flèches du clavier) habillés en cartes ou puces. */
export function RadioGroup<T extends string>({
  legend,
  hint,
  hideLegend,
  options,
  value,
  onChange,
  layout = 'chips',
  name,
  onPick,
}: RadioGroupProps<T>) {
  const autoName = useId();
  const groupName = name ?? autoName;
  const containerClass = {
    cards: styles.cards,
    segmented: styles.segmented,
    chips: styles.chips,
    tiles: styles.tiles,
  }[layout];
  const itemClass = {
    cards: styles.card,
    segmented: styles.segment,
    chips: styles.chip,
    tiles: styles.tile,
  }[layout];
  return (
    <GroupFrame legend={legend} hint={hint} hideLegend={hideLegend}>
      <div className={containerClass}>
        {options.map((option) => (
          <label
            key={option.value}
            className={`${itemClass} ${option.disabled ? styles.disabled : ''}`}
          >
            <input
              type="radio"
              className={styles.input}
              name={groupName}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => {
                onChange(option.value);
              }}
              onClick={(event) => {
                if (event.detail > 0) onPick?.(option.value);
              }}
            />
            {option.emoji !== undefined && (
              <span aria-hidden="true" className={styles.emoji}>
                {option.emoji}
              </span>
            )}
            {layout === 'cards' || layout === 'tiles' ? (
              <span className={styles.cardText}>
                <span className={styles.cardLabel}>{option.label}</span>
                {option.hint !== undefined && (
                  <span className={styles.cardHint}>{option.hint}</span>
                )}
              </span>
            ) : (
              <span>{option.label}</span>
            )}
          </label>
        ))}
      </div>
    </GroupFrame>
  );
}
