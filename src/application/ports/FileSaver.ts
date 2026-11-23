export interface FileToSave {
  readonly name: string;
  readonly mimeType: string;
  readonly content: string;
}

/** Remet un fichier à la personne (téléchargement), sans rien envoyer sur le réseau. */
export interface FileSaver {
  save(file: FileToSave): Promise<void>;
}
