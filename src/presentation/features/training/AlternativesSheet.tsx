import type { Exercise } from '@domain/training';
import { Sheet } from '../../components/Sheet';
import { MUSCLE_GROUP_LABELS } from '../../i18n/labels';
import type { BodyId } from './figure/body';
import { ExerciseThumb } from './ExerciseThumb';
import styles from './AlternativesSheet.module.css';

interface AlternativesSheetProps {
  readonly open: boolean;
  readonly currentName: string | undefined;
  /** Remplaçants adaptés ; `undefined` pendant le chargement. */
  readonly alternatives: readonly Exercise[] | undefined;
  /** Message doux quand il n'y en a aucun (ou quand le chargement a échoué). */
  readonly emptyMessage: string;
  readonly body: BodyId;
  readonly busy: boolean;
  readonly onChoose: (exercise: Exercise) => void;
  readonly onClose: () => void;
}

/** « Remplacer » : jusqu'à trois exercices du même mouvement, adaptés au matériel et à la santé. */
export function AlternativesSheet({
  open,
  currentName,
  alternatives,
  emptyMessage,
  body,
  busy,
  onChoose,
  onClose,
}: AlternativesSheetProps) {
  return (
    <Sheet
      open={open}
      title="Remplacer l’exercice"
      description={
        currentName ? `À la place de « ${currentName} », même mouvement, même effort.` : undefined
      }
      onClose={onClose}
    >
      {alternatives === undefined ? (
        <p role="status" className={styles.status}>
          Je cherche des idées…
        </p>
      ) : alternatives.length === 0 ? (
        <p className={styles.status}>{emptyMessage}</p>
      ) : (
        <ul className={styles.list} aria-label="Exercices proposés">
          {alternatives.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                className={styles.option}
                disabled={busy}
                onClick={() => {
                  onChoose(exercise);
                }}
              >
                <ExerciseThumb exercise={exercise} body={body} className={styles.thumb} />
                <span className={styles.text}>
                  <span className={styles.name}>{exercise.name}</span>
                  <span className={styles.muscles}>
                    {exercise.primaryMuscles.map((m) => MUSCLE_GROUP_LABELS[m]).join(', ')}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
