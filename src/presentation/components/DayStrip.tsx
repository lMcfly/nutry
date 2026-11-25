import { SegmentedTabs } from './SegmentedTabs';
import type { TabItem } from './SegmentedTabs';
import styles from './DayStrip.module.css';

export interface DayStripDay {
  /** Identifiant de l'onglet (index du jour). */
  readonly id: string;
  /** « Lun » */
  readonly weekday: string;
  /** « 23 » */
  readonly dayOfMonth: string;
  /** « lundi 23 novembre, aujourd'hui » */
  readonly ariaLabel: string;
  /** Aujourd'hui : petit point sous le numéro. */
  readonly isToday?: boolean;
  /**
   * Repère sous le numéro, sur la ligne du point (aucune hauteur en plus) : jour de séance
   * (petit trait creux) ou séance faite (trait plein). Le nom accessible le dit aussi.
   */
  readonly mark?: 'seance' | 'fait' | undefined;
}

interface DayStripProps {
  readonly days: readonly DayStripDay[];
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly idPrefix: string;
  readonly label?: string;
  readonly className?: string | undefined;
}

/** Bandeau des jours de la semaine : pastilles « Lun 23 », jour choisi en pastille douce. */
export function DayStrip({
  days,
  value,
  onChange,
  idPrefix,
  label = 'Jours de la semaine',
  className,
}: DayStripProps) {
  const tabs: TabItem<string>[] = days.map((day) => ({
    id: day.id,
    ariaLabel: day.ariaLabel,
    label: (
      <>
        <span className={styles.weekday}>{day.weekday}</span>
        <span className={styles.number}>{day.dayOfMonth}</span>
        <span className={styles.marks} aria-hidden="true">
          <span className={`${styles.dot} ${day.isToday ? styles.today : ''}`} />
          {day.mark !== undefined && (
            <span
              className={`${styles.mark} ${day.mark === 'fait' ? styles.done : ''}`}
              data-mark={day.mark}
            />
          )}
        </span>
      </>
    ),
  }));
  return (
    <SegmentedTabs
      label={label}
      tabs={tabs}
      value={value}
      onChange={onChange}
      idPrefix={idPrefix}
      variant="days"
      className={className}
      controlsPanel={false}
    />
  );
}
