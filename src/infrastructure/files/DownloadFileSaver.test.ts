// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DownloadFileSaver,
  REVOKE_DELAY_MS,
  browserDownloadEnvironment,
} from './DownloadFileSaver';
import type { DownloadEnvironment } from './DownloadFileSaver';

afterEach(() => {
  vi.useRealTimers();
});

describe('DownloadFileSaver', () => {
  it('télécharge le contenu puis libère l’URL', async () => {
    vi.useFakeTimers();
    const env = {
      createObjectURL: vi.fn<(blob: Blob) => string>(() => 'blob:1'),
      revokeObjectURL: vi.fn(),
      download: vi.fn(),
    } satisfies DownloadEnvironment;
    await new DownloadFileSaver(env).save({
      name: 'nutry-sauvegarde-2026-11-23.json',
      mimeType: 'application/json',
      content: '{"a":1}',
    });
    const blob = env.createObjectURL.mock.calls[0]?.[0];
    expect(blob?.type).toBe('application/json;charset=utf-8');
    await expect(blob?.text()).resolves.toBe('{"a":1}');
    expect(env.download).toHaveBeenCalledWith('blob:1', 'nutry-sauvegarde-2026-11-23.json');
    expect(env.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REVOKE_DELAY_MS);
    expect(env.revokeObjectURL).toHaveBeenCalledWith('blob:1');
  });

  it('environnement navigateur : lien temporaire cliqué puis retiré', () => {
    const revokeObjectURL = vi.fn();
    const urlApi = {
      createObjectURL: vi.fn(() => 'blob:x'),
      revokeObjectURL,
    } as unknown as typeof URL;
    const env = browserDownloadEnvironment(document, urlApi);
    const clicks: HTMLAnchorElement[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this);
    });
    expect(env.createObjectURL(new Blob(['x']))).toBe('blob:x');
    env.download('blob:x', 'fichier.json');
    env.revokeObjectURL('blob:x');
    expect(clicks[0]?.download).toBe('fichier.json');
    expect(clicks[0]?.getAttribute('href')).toBe('blob:x');
    expect(document.querySelector('a')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
  });
});
