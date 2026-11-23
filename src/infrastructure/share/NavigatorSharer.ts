import type { ShareResult, Sharer } from '@application/ports';

/** Sous-ensemble de `Navigator` utilisé : injectable pour les tests. */
export interface ShareCapableNavigator {
  share?: (data: { text: string }) => Promise<void>;
  clipboard?: { writeText(text: string): Promise<void> };
}

const isAbort = (error: unknown): boolean => error instanceof Error && error.name === 'AbortError';

/** Web Share API, avec repli sur le presse-papiers. */
export class NavigatorSharer implements Sharer {
  constructor(private readonly nav: ShareCapableNavigator) {}

  async share(text: string): Promise<ShareResult> {
    if (this.nav.share) {
      try {
        await this.nav.share({ text });
        return 'shared';
      } catch (error) {
        // L'utilisateur a fermé la feuille de partage : on ne copie pas à sa place.
        if (isAbort(error)) return 'failed';
      }
    }
    if (this.nav.clipboard) {
      try {
        await this.nav.clipboard.writeText(text);
        return 'copied';
      } catch {
        return 'failed';
      }
    }
    return 'failed';
  }
}
