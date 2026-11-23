import { describe, expect, it, vi } from 'vitest';
import { NavigatorSharer } from './NavigatorSharer';

const abortError = () => Object.assign(new Error('annulé'), { name: 'AbortError' });

describe('NavigatorSharer', () => {
  it('utilise la Web Share API quand elle est disponible', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    await expect(new NavigatorSharer({ share }).share('liste')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'liste' });
  });

  it('copie dans le presse-papiers sans Web Share API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await expect(new NavigatorSharer({ clipboard: { writeText } }).share('x')).resolves.toBe(
      'copied',
    );
  });

  it('se replie sur le presse-papiers si le partage échoue', async () => {
    const share = vi.fn().mockRejectedValue(new Error('NotAllowed'));
    const writeText = vi.fn().mockResolvedValue(undefined);
    const sharer = new NavigatorSharer({ share, clipboard: { writeText } });
    await expect(sharer.share('x')).resolves.toBe('copied');
  });

  it('ne copie pas si l’utilisateur annule le partage', async () => {
    const share = vi.fn().mockRejectedValue(abortError());
    const writeText = vi.fn();
    const sharer = new NavigatorSharer({ share, clipboard: { writeText } });
    await expect(sharer.share('x')).resolves.toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
    // DOMException (navigateur) : reconnue par son nom.
    const domAbort = vi.fn().mockRejectedValue(new DOMException('annulé', 'AbortError'));
    await expect(new NavigatorSharer({ share: domAbort }).share('x')).resolves.toBe('cancelled');
  });

  it('échoue proprement sans aucune capacité', async () => {
    await expect(new NavigatorSharer({}).share('x')).resolves.toBe('failed');
    const writeText = vi.fn().mockRejectedValue(new Error('refusé'));
    await expect(new NavigatorSharer({ clipboard: { writeText } }).share('x')).resolves.toBe(
      'failed',
    );
  });
});
