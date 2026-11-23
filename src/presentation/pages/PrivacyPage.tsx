import { useAppState } from '../app/appState';
import { Page } from '../components/Page';
import { PrivacyContent } from '../features/privacy/PrivacyContent';

export function PrivacyPage() {
  const { profileStatus } = useAppState();
  const hasProfile = profileStatus === 'ready';

  return (
    <Page
      narrow
      title="Confidentialité"
      subtitle="Tes données t’appartiennent."
      scroll
      back={
        hasProfile ? { to: '/profil', label: 'Mon profil' } : { to: '/bienvenue', label: 'Retour' }
      }
    >
      <PrivacyContent />
    </Page>
  );
}
