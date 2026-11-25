import { useEffect, useMemo, useState } from 'react';
import { LOAD_INCREMENT_KG, loadEquipmentOf } from '@domain/training';
import type { Exercise, ExerciseLog, PlannedExercise, SetLog } from '@domain/training';
import { MAX_LOAD_KG, MAX_REPS, MAX_SECONDS } from '@application/usecases';
import { Button } from '../../components/Button';
import { CheckIcon } from '../../components/icons';
import { formatDecimal, formatKg, formatSeconds } from '../../i18n/labels';
import { MiniStepper } from './MiniStepper';
import styles from './SetTracker.module.css';

interface SetTrackerProps {
  readonly exercise: Exercise;
  readonly planned: PlannedExercise;
  readonly log: ExerciseLog;
  readonly busy: boolean;
  /** Valide (ou corrige, ou décoche) une série. */
  readonly onLogSet: (set: SetLog) => void;
  /** « Tout est fait » : valide l'exercice entier. */
  readonly onAllDone: () => void;
}

interface Draft {
  readonly amount: number;
  readonly loadKg: number;
}

const isDone = (log: ExerciseLog, index: number): boolean =>
  log.done || log.sets.some((s) => s.index === index && s.done);

/** Description d'une série pour les lecteurs d'écran et la pastille. */
function describe(set: SetLog | undefined, timed: boolean): string {
  if (!set) return '';
  const amount = timed
    ? set.seconds !== undefined
      ? formatSeconds(set.seconds)
      : ''
    : set.reps !== undefined
      ? `${set.reps} répétitions`
      : '';
  const load = set.loadKg !== undefined && set.loadKg > 0 ? ` à ${formatKg(set.loadKg)}` : '';
  return `${amount}${load}`;
}

/**
 * Séries d'un exercice : une pastille par série (faite ou à faire), saisie rapide des
 * répétitions (ou secondes) et de la charge, puis « Valider la série ». Chaque validation
 * déclenche le minuteur de repos (côté séance).
 */
export function SetTracker({ exercise, planned, log, busy, onLogSet, onAllDone }: SetTrackerProps) {
  const timed = planned.prescription.target.measure === 'duree';
  const loadEquipment = loadEquipmentOf(exercise);
  const loadStep = loadEquipment ? (LOAD_INCREMENT_KG[loadEquipment] ?? 1) : 0;
  const count = Math.max(planned.prescription.sets, log.sets.length);
  const indexes = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  const firstUndone = indexes.find((i) => !isDone(log, i));
  const allDone = firstUndone === undefined;
  const [selected, setSelected] = useState<number>(firstUndone ?? count - 1);

  // Une série validée : on passe à la suivante à faire.
  useEffect(() => {
    setSelected((current) => (isDone(log, current) ? (firstUndone ?? current) : current));
  }, [log, firstUndone]);

  const setAt = (i: number) => log.sets.find((s) => s.index === i);

  const draftFor = (i: number): Draft => {
    const target = planned.prescription.target;
    const own = setAt(i);
    const previous = i > 0 ? setAt(i - 1) : undefined;
    const fallbackAmount = target.measure === 'repetitions' ? target.minReps : target.minSeconds;
    const amount =
      (timed ? (own?.seconds ?? previous?.seconds) : (own?.reps ?? previous?.reps)) ??
      fallbackAmount;
    const loadKg = own?.loadKg ?? previous?.loadKg ?? planned.prescription.loadKg ?? 0;
    return { amount, loadKg };
  };

  const [draft, setDraft] = useState<Draft>(() => draftFor(selected));
  // Nouvelle série choisie (ou exercice remplacé) : on repart de ses valeurs.
  useEffect(() => {
    setDraft(draftFor(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seulement au changement de série
  }, [selected, exercise.id]);

  const selectedDone = isDone(log, selected);
  const number = selected + 1;

  const payload = (done: boolean): SetLog => ({
    index: selected,
    done,
    ...(timed ? { seconds: draft.amount } : { reps: draft.amount }),
    ...(loadEquipment && draft.loadKg > 0 ? { loadKg: draft.loadKg } : {}),
  });

  return (
    <div className={styles.tracker}>
      <div className={styles.pillsRow}>
        <ol className={styles.pills} aria-label="Séries">
          {indexes.map((i) => {
            const done = isDone(log, i);
            const detail = describe(setAt(i), timed);
            return (
              <li key={i}>
                <button
                  type="button"
                  className={[
                    styles.pill,
                    done ? styles.done : '',
                    i === selected ? styles.current : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={i === selected ? 'step' : undefined}
                  aria-label={`Série ${i + 1} sur ${count}, ${done ? `faite${detail ? ` : ${detail}` : ''}` : 'à faire'}`}
                  onClick={() => {
                    setSelected(i);
                  }}
                >
                  {done ? <CheckIcon size={18} /> : <span>{i + 1}</span>}
                </button>
              </li>
            );
          })}
        </ol>
        {!allDone && (
          <button type="button" className={styles.allDone} disabled={busy} onClick={onAllDone}>
            Tout est fait
          </button>
        )}
      </div>

      <div className={styles.editor}>
        <MiniStepper
          label={timed ? 'Secondes' : 'Répétitions'}
          value={draft.amount}
          step={timed ? 5 : 1}
          min={timed ? 5 : 1}
          max={timed ? MAX_SECONDS : MAX_REPS}
          display={String(draft.amount)}
          unit={timed ? 's' : 'rép.'}
          onChange={(amount) => {
            setDraft((d) => ({ ...d, amount }));
          }}
        />
        {loadEquipment && (
          <MiniStepper
            label="Charge"
            value={draft.loadKg}
            step={loadStep}
            min={0}
            max={MAX_LOAD_KG}
            display={draft.loadKg > 0 ? formatDecimal(draft.loadKg) : '—'}
            unit="kg"
            onChange={(loadKg) => {
              setDraft((d) => ({ ...d, loadKg }));
            }}
          />
        )}
      </div>

      <div className={styles.validateRow}>
        {selectedDone && (
          <Button
            variant="ghost"
            small
            disabled={busy}
            onClick={() => {
              onLogSet(payload(false));
            }}
          >
            Décocher
          </Button>
        )}
        <Button
          className={styles.validate}
          variant={selectedDone ? 'secondary' : 'primary'}
          disabled={busy}
          icon={<CheckIcon size={20} />}
          onClick={() => {
            onLogSet(payload(true));
          }}
        >
          {selectedDone ? `Corriger la série ${number}` : `Valider la série ${number}`}
        </Button>
      </div>
    </div>
  );
}
