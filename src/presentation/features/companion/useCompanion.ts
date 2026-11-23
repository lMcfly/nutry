import { useCallback } from 'react';
import type { CompanionView } from '@application/usecases';
import { useDependencies } from '../../app/dependencies';
import { useAsync } from '../../hooks/useAsync';

/** Nutry vu par l'interface (humeur, série, déblocages), rechargeable. */
export function useCompanion(): {
  readonly companion: CompanionView | undefined;
  readonly reload: () => void;
  readonly setCompanion: (view: CompanionView) => void;
} {
  const { getCompanion } = useDependencies();
  const load = useCallback(() => getCompanion(), [getCompanion]);
  const { state, reload, setData } = useAsync(load);
  return {
    companion: state.status === 'ready' ? state.data : undefined,
    reload,
    setCompanion: setData,
  };
}
