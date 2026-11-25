import { useCallback } from 'react';
import { EXERCISE_CREDITS_TEXTS } from '@application/usecases';
import { useDependencies } from '../app/dependencies';
import { ListGroup } from '../components/ListRow';
import { Page } from '../components/Page';
import { ScrollArea } from '../components/ScrollArea';
import { useAsync } from '../hooks/useAsync';
import { plural } from '../i18n/labels';
import styles from './PhotoCreditsPage.module.css';
import own from './ExerciseCreditsPage.module.css';

const T = EXERCISE_CREDITS_TEXTS;

/** Contenu propre de Nutry : fiches d'exercices et mannequins dessinés, sous licence MIT. */
export function ExerciseCreditsPage() {
  const { listExerciseCredits } = useDependencies();
  const load = useCallback(() => listExerciseCredits(), [listExerciseCredits]);
  const { state } = useAsync(load);
  const view = state.status === 'ready' ? state.data : undefined;
  const licenseUrl = view?.credit?.licenseUrl ?? 'https://opensource.org/licenses/MIT';

  return (
    <Page
      narrow
      title={T.title}
      subtitle={T.subtitle}
      back={{ to: '/confidentialite', label: 'Confidentialité' }}
    >
      <p className={styles.intro}>{T.intro}</p>
      {state.status === 'loading' && <p role="status">Un instant…</p>}
      {state.status === 'error' && <p role="alert">Oups, réessaie.</p>}
      {view && (
        <ScrollArea label="Crédits des exercices" className={styles.list}>
          <ListGroup label="Crédits exercices">
            <li className={styles.item}>
              <h2 className={styles.dish}>Fiches et mannequins de Nutry</h2>
              <p className={styles.line}>
                {plural(view.exerciseCount, 'exercice')} : noms, consignes, conseils et dessins des
                mannequins (femme et homme).
              </p>
              <p className={styles.links}>
                <a href={licenseUrl} target="_blank" rel="noopener noreferrer">
                  {T.license}
                  <span className="visually-hidden"> (site externe)</span>
                </a>
              </p>
            </li>
            <li className={styles.item}>
              <h2 className={styles.dish}>{T.videosTitle}</h2>
              {view.videos.length === 0 ? (
                <p className={styles.line}>{T.noVideos}</p>
              ) : (
                view.videos.map(({ exerciseId, exerciseName, video }) => (
                  <p key={`${exerciseId}-${video.src}`} className={styles.line}>
                    {exerciseName} : {video.author} ·{' '}
                    <a href={video.licenseUrl} target="_blank" rel="noopener noreferrer">
                      {video.license}
                    </a>
                  </p>
                ))
              )}
              <p className={styles.line}>{T.externalLink}</p>
            </li>
          </ListGroup>
        </ScrollArea>
      )}
      <p className={own.disclaimer} role="note">
        {T.disclaimer}
      </p>
    </Page>
  );
}
