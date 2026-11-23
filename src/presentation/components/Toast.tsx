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
import { createPortal } from 'react-dom';
import styles from './Toast.module.css';

export type ToastTone = 'info' | 'success' | 'error';

/** Action proposée dans un toast (ex. « Remplacer ce plat maintenant »). */
export interface ToastAction {
  readonly label: string;
  readonly onClick: () => void;
}

interface ToastMessage {
  readonly id: number;
  readonly text: string;
  readonly tone: ToastTone;
  readonly action?: ToastAction;
}

interface ToastApi {
  /**
   * Affiche un message bref et l'annonce aux lecteurs d'écran (aria-live). Avec une
   * action, le toast reste plus longtemps (`TOAST_ACTION_DURATION`) et se ferme au clic.
   */
  readonly show: (text: string, tone?: ToastTone, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Durée d'affichage d'un toast (ms). */
export const TOAST_DURATION = 4000;
/** Durée d'un toast avec action : le temps de lire et d'atteindre le bouton. */
export const TOAST_ACTION_DURATION = 12000;

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (text: string, tone: ToastTone = 'info', action?: ToastAction) => {
      const id = nextId.current++;
      setToasts((current) => [
        ...current.slice(-2),
        { id, text, tone, ...(action ? { action } : {}) },
      ]);
      const timer = setTimeout(
        () => {
          timers.current.delete(timer);
          dismiss(id);
        },
        action ? TOAST_ACTION_DURATION : TOAST_DURATION,
      );
      timers.current.add(timer);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className={styles.region} role="status" aria-live="polite" data-live-region="">
          {toasts.map((toast) =>
            toast.action ? (
              <div
                key={toast.id}
                className={`${styles.toast} ${styles[toast.tone]} ${styles.withAction}`}
              >
                <p>{toast.text}</p>
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    dismiss(toast.id);
                    toast.action?.onClick();
                  }}
                >
                  {toast.action.label}
                </button>
              </div>
            ) : (
              <p key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
                {toast.text}
              </p>
            ),
          )}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- hook couplé au provider
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast doit être utilisé sous <ToastProvider>.');
  return api;
}
