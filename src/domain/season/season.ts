import { monthOf } from '../shared';
import type { IsoDate } from '../shared';
import type { Season } from './season.constants';

/**
 * Saison d'une date, par découpage météorologique en mois entiers :
 * mars-mai printemps, juin-août été, septembre-novembre automne, décembre-février hiver.
 * Choisi plutôt que les équinoxes (20-21 mars…) : plus simple, sans dépendance à l'année,
 * et aligné sur le calendrier des fruits et légumes qui raisonne en mois.
 */
export function seasonOfMonth(month: number): Season {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Mois invalide : ${month}`);
  }
  if (month >= 3 && month <= 5) return 'printemps';
  if (month >= 6 && month <= 8) return 'ete';
  if (month >= 9 && month <= 11) return 'automne';
  return 'hiver';
}

/** Saison de la date ISO `date`. */
export function seasonOf(date: IsoDate): Season {
  return seasonOfMonth(monthOf(date));
}
