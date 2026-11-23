import { useCallback } from 'react';
import { useDependencies } from '../app/dependencies';
import { useAppState } from '../app/appState';
import { ButtonLink } from '../components/Button';
import { Card } from '../components/Card';
import { Page } from '../components/Page';
import { useAsync } from '../hooks/useAsync';
import styles from './PrivacyPage.module.css';

export const CIQUAL_CITATION =
  'Anses. 2025. Table de composition nutritionnelle des aliments Ciqual';

const PROMISES: readonly { emoji: string; title: string; text: string }[] = [
  {
    emoji: '📱',
    title: 'Tout reste sur ton appareil',
    text: 'Ton profil, tes menus, tes avis et tes mesures sont enregistrés uniquement dans ce navigateur.',
  },
  {
    emoji: '🙅',
    title: 'Aucun compte',
    text: 'Pas d’e-mail, pas de mot de passe, pas d’inscription.',
  },
  {
    emoji: '🛰️',
    title: 'Aucun serveur',
    text: 'Aucune donnée n’est envoyée : l’app fonctionne même hors ligne.',
  },
  {
    emoji: '🍪',
    title: 'Aucun traceur',
    text: 'Ni publicité, ni mesure d’audience, ni cookie tiers.',
  },
];

export function PrivacyPage() {
  const { isStoragePersisted } = useDependencies();
  const { profileStatus } = useAppState();
  const load = useCallback(() => isStoragePersisted(), [isStoragePersisted]);
  const { state } = useAsync(load);
  const hasProfile = profileStatus === 'ready';

  return (
    <Page
      title="Confidentialité"
      subtitle="Tes données t’appartiennent."
      back={
        hasProfile ? { to: '/profil', label: 'Mon profil' } : { to: '/bienvenue', label: 'Retour' }
      }
    >
      <ul className={styles.promises}>
        {PROMISES.map((p) => (
          <Card as="li" key={p.title} className={styles.promise}>
            <span className={styles.emoji} aria-hidden="true">
              {p.emoji}
            </span>
            <div>
              <h2 className={styles.title}>{p.title}</h2>
              <p className={styles.text}>{p.text}</p>
            </div>
          </Card>
        ))}
      </ul>

      {state.status === 'ready' && (
        <p className={styles.text}>
          {state.data
            ? '✅ Ton navigateur a accepté de conserver durablement tes données.'
            : 'ℹ️ Ton navigateur peut effacer ces données s’il manque de place : pense à faire une sauvegarde de temps en temps.'}
        </p>
      )}

      {hasProfile && (
        <Card as="section" tone="sunken" aria-labelledby="controls-title">
          <h2 id="controls-title" className={styles.title}>
            Garder la main
          </h2>
          <p className={styles.text}>
            Exporte une sauvegarde (chiffrée si tu veux) ou efface tout, à tout moment.
          </p>
          <div className={styles.actions}>
            <ButtonLink to="/profil#mes-donnees" variant="secondary" small>
              Exporter ou tout effacer
            </ButtonLink>
          </div>
        </Card>
      )}

      <Card as="section" aria-labelledby="sources-title">
        <h2 id="sources-title" className={styles.title}>
          Sources
        </h2>
        <p className={styles.text}>
          Données nutritionnelles : « {CIQUAL_CITATION} », diffusée sous{' '}
          <a
            href="https://www.etalab.gouv.fr/licence-ouverte-open-licence/"
            rel="noreferrer"
            target="_blank"
          >
            Licence Ouverte
          </a>
          .
        </p>
        <p className={styles.text}>
          Nutry ne remplace pas l’avis d’un médecin ou d’un diététicien.
        </p>
      </Card>
    </Page>
  );
}
