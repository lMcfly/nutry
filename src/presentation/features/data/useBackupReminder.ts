import { useCallback, useEffect, useState } from 'react';
import { useDependencies } from '../../app/dependencies';

/**
 * Une sauvegarde serait-elle bienvenue (`getBackupReminder`) ? Une fois le rappel touché, il ne
 * revient pas avant le prochain lancement.
 */
export function useBackupReminder(): { readonly due: boolean; readonly dismiss: () => void } {
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

  const dismiss = useCallback(() => {
    dismissBackupReminder();
    setDue(false);
  }, [dismissBackupReminder]);

  return { due, dismiss };
}
