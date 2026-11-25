import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { MEDICAL_DISCLAIMER } from '@domain/profile';
import { useDependencies } from '../../app/dependencies';
import { useAppState } from '../../app/appState';
import { ButtonLink } from '../../components/Button';
import { ListGroup, ListRow } from '../../components/ListRow';
import { Card } from '../../components/Card';
import { useAsync } from '../../hooks/useAsync';
import { CIQUAL_CITATION } from '../../i18n/labels';
import styles from './PrivacyContent.module.css';
import {
  CheckIcon,
  GlobeIcon,
  DumbbellIcon,
  ImageIcon,
  LockIcon,
  PaletteIcon,
  PersonIcon,
  ShieldIcon,
} from '../../components/icons';

const PROMISES: readonly { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <LockIcon size={22} />,
    title: 'Tout reste sur ton appareil',
    text: 'Ton profil, tes menus, tes avis et tes mesures sont enregistrés uniquement dans ce navigateur.',
  },
  {
    icon: <PersonIcon size={22} />,
    title: 'Aucun compte',
    text: 'Pas d’e-mail, pas de mot de passe, pas d’inscription.',
  },
  {
    icon: <ShieldIcon size={22} />,
    title: 'Aucun serveur',
    text: 'Aucune donnée personnelle n’est envoyée : l’app fonctionne même hors ligne.',
  },
  {
    icon: <GlobeIcon size={22} />,
    title: 'Hébergée par GitHub Pages',
    text: 'Les fichiers de l’app sont servis par GitHub Pages. Comme pour tout site, GitHub voit ton adresse IP quand ils sont téléchargés, mais aucune donnée personnelle ne lui est envoyée.',
  },
  {
    icon: <ImageIcon size={22} />,
    title: 'Photos chargées depuis Unsplash',
    text: 'Les photos de certains plats sont chargées depuis Unsplash (images.unsplash.com), ce qui transmet ton adresse IP à Unsplash, comme pour tout site web. Aucune donnée personnelle ni de santé n’est envoyée. Hors ligne, ou si une photo ne charge pas, une illustration la remplace.',
  },
  {
    icon: <PaletteIcon size={22} />,
    title: 'Ton thème, mémorisé dans le navigateur',
    text: 'Le thème choisi (et quelques repères de session, comme la question du quiz de cette ouverture) est gardé dans ce navigateur pour un affichage immédiat. « Tout effacer » le supprime aussi.',
  },
  {
    icon: <CheckIcon size={22} />,
    title: 'Aucun traceur',
    text: 'Ni publicité, ni mesure d’audience, ni cookie tiers.',
  },
];

/** Les engagements de confidentialité, la source des données et le rappel médical. */
export function PrivacyContent() {
  const { isStoragePersisted } = useDependencies();
  const { profileStatus } = useAppState();
  const load = useCallback(() => isStoragePersisted(), [isStoragePersisted]);
  const { state } = useAsync(load);
  const hasProfile = profileStatus === 'ready';

  return (
    <div className={styles.content}>
      <ul className={styles.promises}>
        {PROMISES.map((p) => (
          <Card as="li" key={p.title} className={styles.promise}>
            <span className={styles.icon}>{p.icon}</span>
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
            ? 'Ton navigateur a accepté de conserver durablement tes données.'
            : 'Ton navigateur peut effacer ces données s’il manque de place : pense à faire une sauvegarde de temps en temps.'}
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
            <ButtonLink to="/moi#mes-donnees" variant="secondary" small>
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
        <p className={styles.text}>{MEDICAL_DISCLAIMER}</p>
      </Card>

      <ListGroup label="Autres informations">
        <ListRow icon={<ImageIcon size={22} />} title="Crédits photos" to="/credits-photos" />
        <ListRow
          icon={<DumbbellIcon size={22} />}
          title="Crédits exercices"
          hint="mannequins et fiches"
          ariaLabel="Crédits exercices : mannequins et fiches de Nutry"
          to="/credits-exercices"
        />
      </ListGroup>
    </div>
  );
}
