import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { CompanionItem } from '@domain/companion';
import { useDependencies } from '../../app/dependencies';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { joinPhrases, unlockPhrase } from '../../i18n/labels';
import { Nutry } from './Nutry';
import type { CompanionView } from '@application/usecases';
import styles from './Celebration.module.css';

type Check = () => void;

const CelebrationContext = createContext<Check>(() => undefined);

/**
 * À appeler après un geste (quiz répondu, repas noté, article coché) : vérifie si Nutry a
 * gagné quelque chose et, si oui, ouvre la célébration. Sans effet hors `CelebrationProvider`.
 */
// eslint-disable-next-line react-refresh/only-export-components -- hook couplé au provider
export function useCelebrationCheck(): Check {
  return useContext(CelebrationContext);
}

/** Confettis sobres : positions et couleurs fixes (pas d'aléa), animés par CSS. */
const CONFETTI = Array.from({ length: 14 }, (_, i) => ({
  left: `${6 + ((i * 37) % 88)}%`,
  delay: `${(i % 5) * 0.12}s`,
  color: ['#e0583a', '#f0b429', '#3d9a5c', '#6fb2e6', '#ff8fa3'][i % 5] ?? '#e0583a',
  rotate: `${(i * 47) % 180}deg`,
}));

interface CelebrationProviderProps {
  readonly children: ReactNode;
}

/**
 * Célébration d'un déblocage : petite modale festive « Nutry a gagné … ! », vérifiée à
 * l'ouverture de l'app et après chaque geste, puis `acknowledgeUnlocks()` à la fermeture.
 */
export function CelebrationProvider({ children }: CelebrationProviderProps) {
  const { getCompanion, acknowledgeUnlocks } = useDependencies();
  const [view, setView] = useState<CompanionView | undefined>();
  const openRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const check = useCallback<Check>(() => {
    if (openRef.current) return;
    void getCompanion().then(
      (companion) => {
        if (!mounted.current || openRef.current) return;
        if (companion.newlyUnlocked.length > 0) {
          openRef.current = true;
          setView(companion);
        }
      },
      () => undefined,
    );
  }, [getCompanion]);

  useEffect(() => {
    check();
  }, [check]);

  const closing = useRef(false);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    // On acquitte AVANT de refermer : un rechargement juste après ne refête rien.
    void acknowledgeUnlocks()
      .catch(() => undefined)
      .then(() => {
        closing.current = false;
        openRef.current = false;
        if (mounted.current) setView(undefined);
      });
  }, [acknowledgeUnlocks]);

  const value = useMemo(() => check, [check]);
  const items: readonly CompanionItem[] = view?.newlyUnlocked ?? [];

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      <Sheet
        open={view !== undefined}
        variant="dialog"
        title="Bravo !"
        closeLabel="Fermer la célébration"
        onClose={close}
        footer={
          <Button block onClick={close}>
            Génial !
          </Button>
        }
      >
        {view && (
          <div className={styles.celebration}>
            <span className={styles.confetti} aria-hidden="true">
              {CONFETTI.map((piece, i) => (
                <i
                  key={i}
                  style={{
                    left: piece.left,
                    animationDelay: piece.delay,
                    background: piece.color,
                    rotate: piece.rotate,
                  }}
                />
              ))}
            </span>
            <Nutry look={view.look} mood="joyeux" size="l" />
            <p className={styles.text} role="status">
              Nutry a gagné {joinPhrases(items.map(unlockPhrase))} !
            </p>
            <p className={styles.emojis} aria-hidden="true">
              {items.map((item) => item.emoji).join(' ')}
            </p>
            <p className={styles.hint}>Retrouve-le dans « Personnaliser » sur ton profil.</p>
          </div>
        )}
      </Sheet>
    </CelebrationContext.Provider>
  );
}
