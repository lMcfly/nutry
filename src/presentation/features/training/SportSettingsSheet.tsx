import { useCallback, useEffect, useState } from 'react';
import { EXERCISE_BODIES } from '@application/usecases';
import type { ExerciseBody } from '@application/usecases';
import type { TrainingInputIssue, TrainingProfileInput } from '@domain/training';
import { useDependencies } from '../../app/dependencies';
import { Button, ButtonLink } from '../../components/Button';
import { RadioGroup } from '../../components/Choice';
import { Sheet } from '../../components/Sheet';
import { useToast } from '../../components/Toast';
import { useAsync } from '../../hooks/useAsync';
import { SportQuestion } from './SportQuestions';
import { sportQuestionIds } from './sportQuestionIds';
import styles from './SportSettingsSheet.module.css';

const BODY_LABELS: Readonly<Record<ExerciseBody, string>> = { femme: 'Femme', homme: 'Homme' };

interface SportSettingsSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  /** Le programme a changé (la semaine se régénère). */
  readonly onSaved?: () => void;
}

/**
 * Réglages du Sport (depuis l'onglet Sport ou « Moi ») : fréquence et jours, matériel, niveau,
 * objectif, durée, étape de grossesse si elle est posée, et corps du mannequin pour le sexe
 * « autre ». Le programme se régénère à l'enregistrement (empreinte des contraintes).
 */
export function SportSettingsSheet({ open, onClose, onSaved }: SportSettingsSheetProps) {
  const { getTrainingProfile, getProfile, saveTrainingProfile, exerciseBody, setExerciseBody } =
    useDependencies();
  const toast = useToast();
  const load = useCallback(async () => {
    const [training, profile] = await Promise.all([getTrainingProfile(), getProfile()]);
    return { training, sex: profile?.profile.sex };
  }, [getTrainingProfile, getProfile]);
  const { state, reload } = useAsync(load);
  const [draft, setDraft] = useState<TrainingProfileInput | undefined>();
  const [body, setBody] = useState<ExerciseBody>(() => exerciseBody() ?? 'femme');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<readonly TrainingInputIssue[]>([]);

  const training = state.status === 'ready' ? state.data.training : undefined;

  // À chaque ouverture : on repart des réponses enregistrées.
  useEffect(() => {
    if (!open) return;
    reload();
    setDirty(false);
    setIssues([]);
  }, [open, reload]);
  useEffect(() => {
    if (training?.status === 'active') setDraft(training.input);
  }, [training]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const result = await saveTrainingProfile(draft);
      if (result.status === 'invalid') {
        setIssues(result.issues);
        return;
      }
      if (result.status === 'saved') {
        setDirty(false);
        toast.show('C’est enregistré ! Ton programme s’adapte.', 'success');
        onSaved?.();
        onClose();
        return;
      }
      toast.show(
        result.status === 'failed' ? result.message : 'Complète d’abord ton profil.',
        'error',
      );
    } catch {
      toast.show('Oups, l’enregistrement n’a pas fonctionné. Réessaie.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const active = training?.status === 'active' && draft !== undefined;

  return (
    <Sheet
      open={open}
      variant="full"
      title="Mon programme sportif"
      onClose={onClose}
      footer={
        active ? (
          <Button
            block
            disabled={!dirty || saving}
            aria-busy={saving}
            onClick={() => {
              void save();
            }}
          >
            {dirty ? 'Enregistrer mon programme' : 'Programme enregistré ✓'}
          </Button>
        ) : undefined
      }
    >
      {state.status === 'loading' && <p role="status">Un instant…</p>}
      {state.status === 'error' && (
        <p role="alert">Tes réglages n’ont pas pu se charger. Réessaie dans un instant.</p>
      )}
      {training?.status === 'inactive' && (
        <div className={styles.inactive}>
          <p>Le Sport n’est pas encore activé. Quelques questions, et ton programme est prêt.</p>
          <ButtonLink to="/sport/bienvenue">Activer le Sport</ButtonLink>
        </div>
      )}
      {active && (
        <div className={styles.form}>
          {sportQuestionIds(training.askPregnancyStage).map((id) => (
            <SportQuestion
              key={id}
              id={id}
              variant="list"
              draft={draft}
              onChange={(patch) => {
                setDraft((d) => (d ? { ...d, ...patch } : d));
                setDirty(true);
                setIssues([]);
              }}
            />
          ))}
          {state.status === 'ready' && state.data.sex === 'autre' && (
            <RadioGroup
              legend="Mannequin des exercices"
              hint="Le corps qui montre les mouvements, sur cet appareil."
              layout="segmented"
              options={EXERCISE_BODIES.map((b) => ({ value: b, label: BODY_LABELS[b] }))}
              value={body}
              onChange={(value) => {
                setBody(value);
                setExerciseBody(value);
              }}
            />
          )}
          {issues.length > 0 && (
            <p role="alert" className={styles.issue}>
              {issues.map((i) => i.message).join(' ')}
            </p>
          )}
          <p className={styles.note} role="note">
            {training.disclaimer}
          </p>
        </div>
      )}
    </Sheet>
  );
}
