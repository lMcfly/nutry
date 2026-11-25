import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PHOTO_CREDITS_TEXTS } from '@application/usecases';
import { useDependencies } from '../app/dependencies';
import { Badge } from '../components/Badge';
import { ListGroup } from '../components/ListRow';
import { Page } from '../components/Page';
import { ScrollArea } from '../components/ScrollArea';
import { useAsync } from '../hooks/useAsync';
import styles from './PhotoCreditsPage.module.css';

const T = PHOTO_CREDITS_TEXTS;

/** Auteurs, licences et sources des photos de plats (exigences des licences CC). */
export function PhotoCreditsPage() {
  const { listPhotoCredits } = useDependencies();
  const load = useCallback(() => listPhotoCredits(), [listPhotoCredits]);
  const { state } = useAsync(load);
  const credits = state.status === 'ready' ? state.data : [];

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
      {state.status === 'ready' && credits.length === 0 && <p>{T.empty}</p>}
      {credits.length > 0 && (
        <ScrollArea label="Liste des crédits photos" className={styles.list}>
          <ListGroup label="Crédits photos">
            {credits.map((credit) => (
              <li key={credit.recipeId} className={styles.item}>
                <h2 className={styles.dish}>
                  {credit.dishName}
                  {credit.illustrative && <Badge>{T.illustrative}</Badge>}
                </h2>
                {credit.provider === 'unsplash' && credit.authorUrl ? (
                  <p className={styles.line}>
                    {T.unsplashBy}{' '}
                    <a href={credit.authorUrl} target="_blank" rel="noopener noreferrer">
                      {credit.author}
                    </a>{' '}
                    {T.unsplashOn}{' '}
                    <a href={T.unsplashHomeUrl} target="_blank" rel="noopener noreferrer">
                      {T.unsplashName}
                    </a>{' '}
                    · {credit.licenseLabel}
                  </p>
                ) : (
                  <p className={styles.line}>
                    Photo : {credit.author} · {credit.licenseLabel}
                  </p>
                )}
                <p className={styles.line}>{T.modified}</p>
                <p className={styles.links}>
                  <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">
                    Licence<span className="visually-hidden"> de la photo : {credit.dishName}</span>
                  </a>
                  <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">
                    {T.sourceByProvider[credit.provider]}
                    <span className="visually-hidden"> pour : {credit.dishName}</span>
                  </a>
                </p>
              </li>
            ))}
          </ListGroup>
        </ScrollArea>
      )}
      <p className={styles.footer}>
        Les mannequins et les fiches d’exercices sont le contenu propre de Nutry (licence MIT) :{' '}
        <Link to="/credits-exercices">crédits exercices</Link>.
      </p>
    </Page>
  );
}
