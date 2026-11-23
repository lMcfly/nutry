import type { Theme } from '@domain/userdata';

const THEME_COLORS: Readonly<Record<'light' | 'dark', string>> = {
  light: '#3d6b4f',
  dark: '#161a15',
};

function prefersDark(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

/**
 * Applique le thème sur <html data-theme> ('system' suit prefers-color-scheme). La copie
 * gardée sur l'appareil (affichage sans flash) est gérée par les cas d'usage
 * (`setTheme`, `cachedTheme`, import, « Tout effacer »).
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = theme;
  const effective = theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[effective]);
}
