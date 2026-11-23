import type { IsoDate } from '@domain/shared';

/** Source du temps : injectée pour des tests déterministes (date du jour, saison). */
export interface Clock {
  /** Instant courant. */
  now(): Date;
  /** Jour calendaire LOCAL de l'appareil (`AAAA-MM-JJ`), pas le jour UTC. */
  today(): IsoDate;
  /** Jour calendaire LOCAL de l'appareil pour un instant donné (même fuseau que `today`). */
  dayOf(instant: Date): IsoDate;
}
