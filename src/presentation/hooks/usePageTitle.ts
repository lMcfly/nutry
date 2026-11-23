import { useEffect } from 'react';
import type { RefObject } from 'react';

export const APP_NAME = 'Nutry';

/** Premier affichage de l'app : on ne vole pas le focus, on le déplace ensuite. */
let firstPageShown = false;

/** Pour les tests : réinitialise le comportement « premier affichage ». */
export function resetPageFocusForTests(): void {
  firstPageShown = false;
}

/**
 * Titre de l'onglet (`document.title`) et, au changement de route, focus sur le titre
 * principal pour que les lecteurs d'écran annoncent la page.
 */
export function usePageTitle(title: string, headingRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
  }, [title]);

  useEffect(() => {
    if (firstPageShown) headingRef.current?.focus({ preventScroll: true });
    firstPageShown = true;
  }, [headingRef]);
}
