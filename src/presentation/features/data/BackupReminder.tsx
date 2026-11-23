import { useEffect, useState } from 'react';
import { useDependencies } from '../../app/dependencies';
import { RoundIconLink } from '../../components/RoundIconButton';

/**
 * Petite pastille ronde quand une sauvegarde serait bienvenue (`getBackupReminder`) : elle
 * mène à « Mes données ». Une fois touchée, elle ne revient pas avant le prochain lancement.
 */
export function BackupReminder() {
  const { getBackupReminder, dismissBackupReminder } = useDependencies();
  const [due, setDue] = useState(false);

  useEffect(() => {
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
    <RoundIconLink
      to="/profil#mes-donnees"
      icon="💾"
      dot
      label="Sauvegarde conseillée : sauvegarder mes données"
      onClick={() => {
        dismissBackupReminder();
        setDue(false);
      }}
    />
  );
}
