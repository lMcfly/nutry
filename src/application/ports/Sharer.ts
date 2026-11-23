/**
 * `shared` : feuille de partage validée ; `copied` : repli presse-papiers ;
 * `cancelled` : la personne a fermé la feuille de partage (pas une erreur, rien à afficher) ;
 * `failed` : ni partage ni copie possibles.
 */
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Partage d'un texte (Web Share API, avec repli presse-papiers). */
export interface Sharer {
  share(text: string): Promise<ShareResult>;
}
