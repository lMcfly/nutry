import { useEffect, useState } from 'react';
import { useDependencies } from '../app/dependencies';

type PhotoUrls = Readonly<Record<string, string>>;

/** Photos déjà chargées, par cas d'usage : pas de scintillement à chaque nouvelle carte. */
const loaded = new WeakMap<object, PhotoUrls>();

/**
 * Adresse de la photo d'une recette, ou `undefined` (pas de photo, chargement en cours ou
 * échec) : `DishImage` affiche alors l'illustration.
 */
export function useRecipePhoto(recipeId: string | undefined): string | undefined {
  const { getPhotoUrls } = useDependencies();
  const [urls, setUrls] = useState<PhotoUrls | undefined>(() => loaded.get(getPhotoUrls));

  useEffect(() => {
    if (loaded.has(getPhotoUrls)) return;
    let active = true;
    getPhotoUrls().then(
      (value) => {
        loaded.set(getPhotoUrls, value);
        if (active) setUrls(value);
      },
      () => {
        // Les illustrations suffisent : rien à signaler.
      },
    );
    return () => {
      active = false;
    };
  }, [getPhotoUrls]);

  return recipeId === undefined ? undefined : urls?.[recipeId];
}
