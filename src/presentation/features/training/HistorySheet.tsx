import { useCallback, useEffect } from 'react';
import type { SessionHistoryEntry } from '@domain/training';
import { useDependencies } from '../../app/dependencies';
import { CheckCircleIcon, TimerIcon } from '../../components/icons';
import { Sheet } from '../../components/Sheet';
import { useAsync } from '../../hooks/useAsync';
import {
  EFFORT_EMOJIS,
  EFFORT_LABELS,
  SPORT_ACCESSORY_EMOJIS,
  SPORT_ACCESSORY_PHRASES,
  formatDayLong,
  formatDayShort,
  plural,
} from '../../i18n/labels';
import styles from './HistorySheet.module.css';

/** Semaines montrées dans la progression (les plus récentes). */
const WEEKS_SHOWN = 6;

interface HistorySheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/** Séances faites, de la plus récente à la plus ancienne, et une progression simple par semaine. */
export function HistorySheet({ open, onClose }: HistorySheetProps) {
  const { getTrainingHistory, getSportRewards } = useDependencies();
  const load = useCallback(async () => {
    const [history, rewards] = await Promise.all([getTrainingHistory(), getSportRewards()]);
    return { history, rewards };
  }, [getTrainingHistory, getSportRewards]);
  const { state, reload } = useAsync(load);
  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  const data = state.status === 'ready' ? state.data : undefined;
  const weeks = data ? weeklyCounts(data.history.entries) : [];
  const best = Math.max(1, ...weeks.map((w) => w.count));

  return (
    <Sheet open={open} variant="full" title="Mes séances" onClose={onClose}>
      {state.status === 'loading' && <p role="status">Un instant…</p>}
      {state.status === 'error' && (
        <p role="alert">L’historique n’a pas pu se charger. Réessaie dans un instant.</p>
      )}
      {data && (
        <div className={styles.history}>
          <section className={styles.summary} aria-label="En résumé">
            <p className={styles.total}>
              <strong>{data.history.sessionsCompleted}</strong>{' '}
              {data.history.sessionsCompleted > 1 ? 'séances terminées' : 'séance terminée'}
            </p>
            {data.rewards.next ? (
              <p className={styles.next}>
                Encore {plural(data.rewards.next.remaining, 'séance')} pour{' '}
                {SPORT_ACCESSORY_PHRASES[data.rewards.next.accessory.id]} de Nutry{' '}
                <span aria-hidden="true">
                  {SPORT_ACCESSORY_EMOJIS[data.rewards.next.accessory.id]}
                </span>
              </p>
            ) : (
              <p className={styles.next}>Nutry a tous ses accessoires sportifs, bravo !</p>
            )}
          </section>

          {weeks.length > 0 && (
            <section aria-labelledby="history-weeks" className={styles.section}>
              <h3 id="history-weeks" className={styles.heading}>
                Tes dernières semaines
              </h3>
              <ul className={styles.weeks}>
                {weeks.map((week) => (
                  <li
                    key={week.weekStart}
                    className={styles.week}
                    aria-label={`Semaine du ${formatDayShort(week.weekStart)} : ${plural(week.count, 'séance terminée', 'séances terminées')}`}
                  >
                    <span className={styles.bars} aria-hidden="true">
                      {Array.from({ length: best }, (_, i) => (
                        <span key={i} className={i < week.count ? styles.barOn : styles.bar} />
                      ))}
                    </span>
                    <span className={styles.weekLabel} aria-hidden="true">
                      {formatDayShort(week.weekStart)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="history-list" className={styles.section}>
            <h3 id="history-list" className={styles.heading}>
              Séances
            </h3>
            {data.history.entries.length === 0 ? (
              <p className={styles.empty}>Pas encore de séance : la première sera la plus belle.</p>
            ) : (
              <ul className={styles.list}>
                {data.history.entries.map((entry) => (
                  <li key={entry.id} className={styles.entry}>
                    <span className={styles.entryIcon} aria-hidden="true">
                      {entry.status === 'terminee' ? (
                        <CheckCircleIcon size={22} />
                      ) : (
                        <TimerIcon size={22} />
                      )}
                    </span>
                    <span className={styles.entryText}>
                      <span className={styles.entryTitle}>{entry.title ?? 'Séance'}</span>
                      <span className={styles.entryMeta}>
                        {formatDayLong(entry.date)} · {plural(entry.doneSets, 'série')}
                        {entry.status === 'en-cours' ? ' · en cours' : ''}
                      </span>
                    </span>
                    {entry.effort && (
                      <span className={styles.effort} title={EFFORT_LABELS[entry.effort]}>
                        <span aria-hidden="true">{EFFORT_EMOJIS[entry.effort]}</span>
                        <span className="visually-hidden">
                          Ressenti : {EFFORT_LABELS[entry.effort]}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}

/** Séances terminées par semaine, des plus anciennes aux plus récentes. */
function weeklyCounts(entries: readonly SessionHistoryEntry[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status !== 'terminee') continue;
    counts.set(entry.weekStart, (counts.get(entry.weekStart) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-WEEKS_SHOWN)
    .map(([weekStart, count]) => ({ weekStart, count }));
}
