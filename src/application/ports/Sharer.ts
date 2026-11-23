export type ShareResult = 'shared' | 'copied' | 'failed';

/** Partage d'un texte (Web Share API, avec repli presse-papiers). */
export interface Sharer {
  share(text: string): Promise<ShareResult>;
}
