import { useEffect, useState } from 'react';
import type { ActivitySuggestion } from '@application/usecases';
import { ACTIVITY_SUGGESTION_TEXTS } from '@domain/training';
import { useDependencies } from '../../app/dependencies';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { ChevronRightIcon, DumbbellIcon } from '../../components/icons';
import { useToast } from '../../components/Toast';
import { useAsync } from '../../hooks/useAsync';
import { ACTIVITY_LABELS } from '../../i18n/labels';
import styles from './ActivitySuggestionCard.module.css';

interface ActivitySuggestionCardProps {
  /** Appelé après une mise à jour du niveau d'activité (le profil affiché doit se recharger). */
  readonly onAccepted: () => void;
  /** La ligne est affichée ou non : l'écran resserre sa mise en page pour rester sans défilement. */
  readonly onVisibleChange?: ((visible: boolean) => void) | undefined;
}

/**
 * Carte « Moi » : le programme de Sport prévoit plus d'activité que le niveau déclaré. Une ligne
 * discrète (la page ne défile jamais) ouvre l'explication : relever le niveau d'UN cran, sur
 * confirmation, ou refuser d'un toucher. Rien n'est modifié sans « Oui » ; aucune calorie, aucune
 * dépense affichée (ADR 0015).
 */
export function ActivitySuggestionCard({
  onAccepted,
  onVisibleChange,
}: ActivitySuggestionCardProps) {
  const { getActivitySuggestion, acceptActivitySuggestion, dismissActivitySuggestion } =
    useDependencies();
  const toast = useToast();
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { state } = useAsync<ActivitySuggestion | undefined>(getActivitySuggestion);

  const data = state.status === 'ready' ? state.data : undefined;
  const visible = !hidden && data !== undefined;
  useEffect(() => {
    onVisibleChange?.(visible);
    return () => {
      onVisibleChange?.(false);
    };
  }, [visible, onVisibleChange]);

  if (hidden || !data) return null;
  const { current, suggested, weeklyMinutes } = data;

  const close = () => {
    setOpen(false);
  };
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
      setOpen(false);
      setHidden(true);
    } catch {
      toast.show('Oups, ça n’a pas fonctionné. Réessaie.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const accept = () =>
    run(async () => {
      const result = await acceptActivitySuggestion();
      if (result.status === 'updated') {
        toast.show(ACTIVITY_SUGGESTION_TEXTS.accepted, 'success');
        onAccepted();
      }
    });
  const dismiss = () => run(dismissActivitySuggestion);

  return (
    <section aria-label="Niveau d’activité" className={styles.card}>
      <button
        type="button"
        className={styles.chip}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        <DumbbellIcon size={20} />
        <span className={styles.chipText}>{ACTIVITY_SUGGESTION_TEXTS.title}</span>
        <ChevronRightIcon size={18} />
      </button>
      <Sheet
        open={open}
        variant="dialog"
        title={ACTIVITY_SUGGESTION_TEXTS.title}
        onClose={close}
        footer={
          <div className={styles.actions}>
            <Button
              disabled={busy}
              onClick={() => {
                void accept();
              }}
            >
              {ACTIVITY_SUGGESTION_TEXTS.accept}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                void dismiss();
              }}
            >
              {ACTIVITY_SUGGESTION_TEXTS.dismiss}
            </Button>
          </div>
        }
      >
        <p className={styles.body}>
          {ACTIVITY_SUGGESTION_TEXTS.body(
            weeklyMinutes,
            ACTIVITY_LABELS[current].toLowerCase(),
            ACTIVITY_LABELS[suggested].toLowerCase(),
          )}
        </p>
      </Sheet>
    </section>
  );
}
