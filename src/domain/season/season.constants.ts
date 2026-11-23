/** Saisons du calendrier France métropolitaine (identifiants ASCII). */
export const SEASONS = ['printemps', 'ete', 'automne', 'hiver'] as const;
export type Season = (typeof SEASONS)[number];
