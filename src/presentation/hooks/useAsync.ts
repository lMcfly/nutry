import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: T }
  | { readonly status: 'error'; readonly error: unknown };

export interface AsyncResult<T> {
  readonly state: AsyncState<T>;
  /** Relance le chargement (sans repasser par l'état `loading`). */
  readonly reload: () => void;
  /** Remplace la donnée (résultat d'une action qui renvoie la vue à jour). */
  readonly setData: (data: T) => void;
}

/**
 * Charge une donnée asynchrone (un cas d'usage) et ignore les réponses périmées.
 * `load` doit être stable (useCallback) : il est relancé quand il change.
 */
export function useAsync<T>(load: () => Promise<T>): AsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    load().then(
      (data) => {
        if (active) setState({ status: 'ready', data });
      },
      (error: unknown) => {
        if (active) setState({ status: 'error', error });
      },
    );
    return () => {
      active = false;
    };
  }, [load, version]);

  const reload = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const setData = useCallback((data: T) => {
    setState({ status: 'ready', data });
  }, []);

  return { state, reload, setData };
}
