import { useCallback, useState } from 'react';
import type { ExerciseSheet } from '@application/usecases';
import type { Exercise } from '@domain/training';
import { useDependencies } from '../../app/dependencies';
import { RadioGroup } from '../../components/Choice';
import { ExternalIcon, ShieldIcon } from '../../components/icons';
import { ScrollArea } from '../../components/ScrollArea';
import { Sheet } from '../../components/Sheet';
import { useAsync } from '../../hooks/useAsync';
import { EQUIPMENT_EMOJIS, EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from '../../i18n/labels';
import type { BodyId } from './figure/body';
import { ExerciseFigure } from './figure/ExerciseFigure';
import { figureOf } from './figure/exerciseFigure';
import type { FigureMode } from './figure/ExerciseFigure';
import { figureMuscles } from './format';
import styles from './TutoSheet.module.css';

type ShownMode = Extract<FigureMode, 'animated' | 'start' | 'end'>;

const MODES: readonly { value: ShownMode; label: string }[] = [
  { value: 'animated', label: 'Mouvement' },
  { value: 'start', label: 'Départ' },
  { value: 'end', label: 'Arrivée' },
];

interface TutoData {
  readonly sheet: ExerciseSheet | undefined;
  readonly easier: Exercise | undefined;
  readonly harder: Exercise | undefined;
}

interface TutoSheetProps {
  /** Exercice affiché ; absent : feuille fermée. */
  readonly exercise: Pick<Exercise, 'id' | 'name'> | undefined;
  readonly body: BodyId;
  readonly onClose: () => void;
}

/**
 * « Voir le tuto » : mannequin animé avec repères (pause, départ, arrivée), consignes
 * numérotées, conseils de sécurité, muscles, matériel, variantes et recherche de vidéo.
 */
export function TutoSheet({ exercise, body, onClose }: TutoSheetProps) {
  return (
    <Sheet
      open={exercise !== undefined}
      variant="full"
      wide
      title={exercise ? `Tuto : ${exercise.name}` : 'Tuto'}
      closeLabel="Fermer le tuto"
      onClose={onClose}
    >
      {exercise !== undefined && <TutoContent exerciseId={exercise.id} body={body} />}
    </Sheet>
  );
}

function TutoContent({ exerciseId, body }: { readonly exerciseId: string; readonly body: BodyId }) {
  const { getExerciseSheet } = useDependencies();
  const [mode, setMode] = useState<ShownMode>('animated');
  const load = useCallback(async (): Promise<TutoData> => {
    const sheet = await getExerciseSheet(exerciseId);
    const variant = async (id: string | undefined) =>
      id === undefined ? undefined : (await getExerciseSheet(id))?.exercise;
    const [easier, harder] = await Promise.all([
      variant(sheet?.exercise.easierId),
      variant(sheet?.exercise.harderId),
    ]);
    return { sheet, easier, harder };
  }, [getExerciseSheet, exerciseId]);
  const { state } = useAsync(load);

  if (state.status === 'loading') {
    return (
      <p role="status" className={styles.status}>
        J’ouvre la fiche…
      </p>
    );
  }
  const sheet = state.status === 'ready' ? state.data.sheet : undefined;
  if (!sheet) {
    return (
      <p role="alert" className={styles.status}>
        Cette fiche n’a pas pu s’ouvrir. Réessaie dans un instant : ta séance, elle, continue.
      </p>
    );
  }
  const { exercise, media, disclaimer } = sheet;
  const data = state.status === 'ready' ? state.data : undefined;
  const youtube = media?.links[0];

  return (
    <div className={styles.tuto}>
      <div className={styles.visual}>
        <div className={styles.figureBox}>
          <ExerciseFigure
            {...figureOf(exercise)}
            body={body}
            mode={mode}
            guides
            highlight={figureMuscles(exercise)}
            size="l"
            className={styles.figure}
          />
        </div>
        <RadioGroup
          legend="Montrer"
          hideLegend
          layout="segmented"
          options={MODES}
          value={mode}
          onChange={setMode}
        />
      </div>

      <ScrollArea label={`Fiche : ${exercise.name}`} className={styles.details}>
        <section aria-labelledby="tuto-muscles" className={styles.section}>
          <h4 id="tuto-muscles" className={styles.heading}>
            Muscles
          </h4>
          <ul className={styles.chips} aria-label="Muscles principaux">
            {exercise.primaryMuscles.map((m) => (
              <li key={m} className={`${styles.chip} ${styles.primary}`}>
                {MUSCLE_GROUP_LABELS[m]}
              </li>
            ))}
          </ul>
          {exercise.secondaryMuscles.length > 0 && (
            <ul className={styles.chips} aria-label="Muscles secondaires">
              {exercise.secondaryMuscles.map((m) => (
                <li key={m} className={styles.chip}>
                  {MUSCLE_GROUP_LABELS[m]}
                </li>
              ))}
            </ul>
          )}
          <p className={styles.legend}>
            <span className={`${styles.swatch} ${styles.primary}`} aria-hidden="true" /> principaux{' '}
            {exercise.secondaryMuscles.length > 0 && (
              <>
                <span className={styles.swatch} aria-hidden="true" /> en renfort
              </>
            )}
          </p>
        </section>

        <section aria-labelledby="tuto-materiel" className={styles.section}>
          <h4 id="tuto-materiel" className={styles.heading}>
            Matériel
          </h4>
          {exercise.equipment.length === 0 ? (
            <p>Aucun : le poids du corps suffit.</p>
          ) : (
            <ul className={styles.chips}>
              {exercise.equipment.map((e) => (
                <li key={e} className={styles.chip}>
                  <span aria-hidden="true">{EQUIPMENT_EMOJIS[e]}</span> {EQUIPMENT_LABELS[e]}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="tuto-etapes" className={styles.section}>
          <h4 id="tuto-etapes" className={styles.heading}>
            Comment faire
          </h4>
          <ol className={styles.steps}>
            {exercise.instructions.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        {exercise.tips.length > 0 && (
          <section aria-labelledby="tuto-conseils" className={styles.section}>
            <h4 id="tuto-conseils" className={styles.heading}>
              Conseils de sécurité
            </h4>
            <ul className={styles.tips}>
              {exercise.tips.map((tip) => (
                <li key={tip}>
                  <ShieldIcon size={18} />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(data?.easier ?? data?.harder) !== undefined && (
          <section aria-labelledby="tuto-variantes" className={styles.section}>
            <h4 id="tuto-variantes" className={styles.heading}>
              Variantes
            </h4>
            <dl className={styles.variants}>
              {data?.easier && (
                <div>
                  <dt>Plus facile</dt>
                  <dd>{data.easier.name}</dd>
                </div>
              )}
              {data?.harder && (
                <div>
                  <dt>Plus difficile</dt>
                  <dd>{data.harder.name}</dd>
                </div>
              )}
            </dl>
          </section>
        )}

        {media?.videos.map((video) => (
          <figure key={video.src} className={styles.video}>
            <video
              src={video.src}
              poster={video.poster}
              controls
              muted
              playsInline
              preload="none"
            />
            <figcaption>
              Vidéo : {video.author} ·{' '}
              <a href={video.licenseUrl} target="_blank" rel="noopener noreferrer">
                {video.license}
              </a>
            </figcaption>
          </figure>
        ))}

        {youtube && (
          <a
            className={styles.youtube}
            href={youtube.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Voir une vidéo : chercher sur YouTube (site externe, nouvel onglet)"
          >
            <ExternalIcon size={20} />
            Voir une vidéo
            <span className={styles.external}>YouTube, site externe</span>
          </a>
        )}

        <p className={styles.credit}>Fiche et dessin : Nutry · licence MIT. {disclaimer}</p>
      </ScrollArea>
    </div>
  );
}
