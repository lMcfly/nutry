import type { Clock } from '@application/ports';
import type { IsoDate } from '@domain/shared';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Horloge de l'appareil ; `today()` suit le fuseau local (minuit à Paris, pas à Londres). */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  today(): IsoDate {
    return localIsoDate(this.now());
  }

  dayOf(instant: Date): IsoDate {
    return localIsoDate(instant);
  }
}

/** Jour calendaire local d'un instant, au format `AAAA-MM-JJ`. */
export function localIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
