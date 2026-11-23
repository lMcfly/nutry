import { useEffect, useState } from 'react';
import { useDependencies } from '../../app/dependencies';
import { ButtonLink } from '../../components/Button';
import { Notice } from '../../components/Notice';

/** Clé de session : une fois masqué, le rappel ne revient pas avant le prochain lancement. */
const DISMISS_KEY = 'nutry.backup-reminder.dismissed';

function isDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Carte douce, fermable, quand une sauvegarde serait bienvenue (`getBackupReminder`). */
export function BackupReminder() {
  const { getBackupReminder } = useDependencies();
  const [due, setDue] = useState(false);

  useEffect(() => {
    if (isDismissed()) return undefined;
    let active = true;
    void getBackupReminder().then((reminder) => {
      if (active) setDue(reminder.due);
    });
    return () => {
      active = false;
    };
  }, [getBackupReminder]);

  if (!due) return null;

  return (
    <Notice
      tone="info"
      emoji="💾"
      title="Et si tu faisais une sauvegarde ?"
      dismissLabel="Masquer le rappel de sauvegarde"
      onDismiss={() => {
        setDue(false);
        try {
          sessionStorage.setItem(DISMISS_KEY, '1');
        } catch {
          // ignoré
        }
      }}
      action={
        <ButtonLink to="/profil#mes-donnees" small variant="secondary">
          Sauvegarder mes données
        </ButtonLink>
      }
    >
      Tes données ne vivent que sur ce téléphone : une copie te met à l’abri d’un changement
      d’appareil.
    </Notice>
  );
}
