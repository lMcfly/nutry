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
}

interface DayStripProps {
  readonly days: readonly DayStripDay[];
  readonly value: string;
  readonly onChange: (id: string) => void;
  readonly idPrefix: string;
  readonly label?: string;
}

/** Bandeau des jours de la semaine : pastilles « Lun 23 », jour choisi en couleur pleine. */
export function DayStrip({
  days,
  value,
  onChange,
  idPrefix,
  label = 'Jours de la semaine',
}: DayStripProps) {
  const tabs: TabItem<string>[] = days.map((day) => ({
    id: day.id,
    ariaLabel: day.ariaLabel,
    label: (
      <>
        <span className={styles.weekday}>{day.weekday}</span>
        <span className={styles.number}>{day.dayOfMonth}</span>
        <span className={`${styles.dot} ${day.isToday ? styles.today : ''}`} aria-hidden="true" />
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
      controlsPanel={false}
    />
  );
}
