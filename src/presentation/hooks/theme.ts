import type { Theme } from '@domain/userdata';

/** Copie locale du thème : appliqué avant que la base ne réponde (pas de flash). */
const THEME_CACHE_KEY = 'nutry.theme';

const THEME_COLORS: Readonly<Record<'light' | 'dark', string>> = {
  light: '#3d6b4f',
  dark: '#161a15',
};

function prefersDark(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

/** Applique le thème sur <html data-theme> ('system' suit prefers-color-scheme). */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme;
  const effective = theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[effective]);
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme);
  } catch {
    // Stockage indisponible (navigation privée…) : sans conséquence.
  }
}

export function cachedTheme(): Theme | undefined {
  try {
    const value = localStorage.getItem(THEME_CACHE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : undefined;
  } catch {
    return undefined;
  }
}
