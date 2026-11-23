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

interface ToastMessage {
  readonly id: number;
  readonly text: string;
  readonly tone: ToastTone;
}

interface ToastApi {
  /** Affiche un message bref et l'annonce aux lecteurs d'écran (aria-live). */
  readonly show: (text: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Durée d'affichage d'un toast (ms). */
export const TOAST_DURATION = 4000;

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

  const show = useCallback((text: string, tone: ToastTone = 'info') => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, text, tone }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts((current) => current.filter((t) => t.id !== id));
    }, TOAST_DURATION);
    timers.current.add(timer);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className={styles.region} role="status" aria-live="polite" data-live-region="">
          {toasts.map((toast) => (
            <p key={toast.id} className={`${styles.toast} ${styles[toast.tone]}`}>
              {toast.text}
            </p>
          ))}
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
