import { useEffect, useState } from 'react';
import type { PhotoImage } from '@application/usecases';
import { useDependencies } from '../app/dependencies';

type PhotoImages = Readonly<Record<string, PhotoImage>>;

/** Photos déjà chargées, par cas d'usage : pas de scintillement à chaque nouvelle carte. */
const loaded = new WeakMap<object, PhotoImages>();

/**
 * Image (adresse, variantes) de la photo d'une recette, ou `undefined` (pas de photo, chargement en cours ou
 * échec) : `DishImage` affiche alors l'illustration.
 */
export function useRecipePhoto(recipeId: string | undefined): PhotoImage | undefined {
  const { getPhotoImages } = useDependencies();
  const [images, setImages] = useState<PhotoImages | undefined>(() => loaded.get(getPhotoImages));

  useEffect(() => {
    if (loaded.has(getPhotoImages)) return;
    let active = true;
    getPhotoImages().then(
      (value) => {
        loaded.set(getPhotoImages, value);
        if (active) setImages(value);
      },
      () => {
        // Les illustrations suffisent : rien à signaler.
      },
    );
    return () => {
      active = false;
    };
  }, [getPhotoImages]);

  return recipeId === undefined ? undefined : images?.[recipeId];
}
