import { useEffect, useState } from 'react';

function read(query: string): boolean {
  // `matchMedia` est absent de jsdom (tests) : on retombe sur « faux » (mise en page téléphone).
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

/** Vrai tant que la requête média correspond (suit les rotations et redimensionnements). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => read(query));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const update = () => {
      setMatches(list.matches);
    };
    update();
    list.addEventListener('change', update);
    return () => {
      list.removeEventListener('change', update);
    };
  }, [query]);
  return matches;
}
