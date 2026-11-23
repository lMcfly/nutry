import type { Level } from '../recipe';
import type { IsoDate } from '../shared';

export const MEAL_SLOTS = ['petit-dejeuner', 'dejeuner', 'diner'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** 0 = lundi … 6 = dimanche. */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const DAY_INDEXES: readonly DayIndex[] = [0, 1, 2, 3, 4, 5, 6];

/** Composantes nommées du score d'une recette. */
export type ScoreComponentKey =
  'aime' | 'notes' | 'saison' | 'temps' | 'niveau' | 'variete' | 'hasard';

export interface ScoreComponent {
  readonly key: ScoreComponentKey;
  readonly points: number;
}

/** Faits ayant conduit au score, réutilisés pour « Pourquoi ce plat ? ». */
export interface ScoreFacts {
  /** Aliments aimés présents (tels que saisis par l'utilisateur). */
  readonly likedTerms: readonly string[];
  /** La recette est indiquée pour la saison du jour. */
  readonly seasonMatch: boolean;
  /** Ingrédients du calendrier de saison du mois. */
  readonly seasonalProduce: readonly string[];
  readonly totalMinutes: number;
  /** Préparation + cuisson dans le temps disponible. */
  readonly fitsTime: boolean;
  /** Avis passés positifs sur ce plat. */
  readonly ratedPositively: boolean;
  /** Préparable pendant la session du dimanche. */
  readonly batchFriendly: boolean;
  /** Protéine pas encore servie cette semaine. */
  readonly newProtein: boolean;
}

/** Score d'une recette : somme de composantes explicables. */
export interface ScoreBreakdown {
  readonly total: number;
  readonly components: readonly ScoreComponent[];
  readonly facts: ScoreFacts;
}

/** Contrainte assouplie faute de recette la respectant. */
export type RelaxedConstraint = 'variete-proteine' | 'niveau' | 'doublon' | 'temps';

/** Un repas planifié. */
export interface PlannedMeal {
  /** Identifiant stable dans la semaine, ex. `2-diner`. */
  readonly id: string;
  readonly dayIndex: DayIndex;
  readonly date: IsoDate;
  readonly slot: MealSlot;
  readonly recipeId: string;
  /** Restes d'un repas précédent : rien à cuisiner. */
  readonly isLeftover: boolean;
  /** Repas source des restes (si `isLeftover`). */
  readonly leftoverOf?: string;
  /** Niveau demandé pour ce jour (absent au petit-déjeuner). */
  readonly requestedLevel?: Level;
  readonly relaxed: readonly RelaxedConstraint[];
  readonly score: ScoreBreakdown;
}

export type PlanNoticeCode =
  'aucune-recette-compatible' | 'petit-dejeuner-indisponible' | 'contraintes-assouplies';

export interface PlanNotice {
  readonly code: PlanNoticeCode;
  readonly message: string;
}

/** Menu d'une semaine (lundi → dimanche). */
export interface WeeklyPlan {
  /** Lundi de la semaine concernée. */
  readonly weekStart: IsoDate;
  /** Repas triés par jour puis par créneau. */
  readonly meals: readonly PlannedMeal[];
  readonly notices: readonly PlanNotice[];
}
