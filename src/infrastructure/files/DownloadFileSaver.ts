import type { FileSaver, FileToSave } from '@application/ports';

/** Ce dont le téléchargement a besoin : injectable pour les tests. */
export interface DownloadEnvironment {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  /** Déclenche le téléchargement de `url` sous le nom `fileName`. */
  download(url: string, fileName: string): void;
}

/** Délai avant de libérer l'URL (certains navigateurs lisent le blob après le clic). */
export const REVOKE_DELAY_MS = 10_000;

/** Environnement du navigateur : lien `<a download>` temporaire. */
export function browserDownloadEnvironment(doc: Document, urlApi: typeof URL): DownloadEnvironment {
  return {
    createObjectURL: (blob) => urlApi.createObjectURL(blob),
    revokeObjectURL: (url) => {
      urlApi.revokeObjectURL(url);
    },
    download(url, fileName) {
      const link = doc.createElement('a');
      link.href = url;
      link.download = fileName;
      link.rel = 'noopener';
      link.style.display = 'none';
      doc.body.append(link);
      link.click();
      link.remove();
    },
  };
}

/** Remet un fichier à la personne par un téléchargement local (aucun réseau). */
export class DownloadFileSaver implements FileSaver {
  constructor(private readonly env: DownloadEnvironment) {}

  save(file: FileToSave): Promise<void> {
    const blob = new Blob([file.content], { type: `${file.mimeType};charset=utf-8` });
    const url = this.env.createObjectURL(blob);
    try {
      this.env.download(url, file.name);
    } finally {
      setTimeout(() => {
        this.env.revokeObjectURL(url);
      }, REVOKE_DELAY_MS);
    }
    return Promise.resolve();
  }
}
