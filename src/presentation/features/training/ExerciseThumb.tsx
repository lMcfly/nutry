import type { Exercise } from '@domain/training';
import type { BodyId } from './figure/body';
import { ExerciseFigure } from './figure/ExerciseFigure';
import { figureOf } from './figure/exerciseFigure';
import { figureMuscles } from './format';
import styles from './ExerciseThumb.module.css';

interface ExerciseThumbProps {
  readonly exercise: Pick<
    Exercise,
    'id' | 'equipment' | 'movement' | 'primaryMuscles' | 'secondaryMuscles'
  >;
  readonly body: BodyId;
  readonly className?: string | undefined;
}

/**
 * Petit mannequin (pose de départ, sans animation) : décoratif, le nom de l'exercice est
 * toujours écrit à côté.
 */
export function ExerciseThumb({ exercise, body, className }: ExerciseThumbProps) {
  return (
    <div className={[styles.thumb, className ?? ''].filter(Boolean).join(' ')} aria-hidden="true">
      <ExerciseFigure
        {...figureOf(exercise)}
        body={body}
        mode="start"
        guides={false}
        highlight={figureMuscles(exercise as Exercise)}
        size="s"
        className={styles.figure}
      />
    </div>
  );
}
