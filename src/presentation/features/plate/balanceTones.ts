import type { BalanceGauge } from '@domain/mealplan';
import type { GaugeTone } from '../../components/Gauge';

/** Une couleur par catégorie d'équilibre de la semaine. */
export const BALANCE_TONES: Readonly<Record<BalanceGauge['key'], GaugeTone>> = {
  vegetables: 'veg',
  legumes: 'protein',
  fish: 'fish',
  wholeGrains: 'starch',
};

export const BALANCE_EMOJIS: Readonly<Record<BalanceGauge['key'], string>> = {
  vegetables: '🥦',
  legumes: '🫘',
  fish: '🐟',
  wholeGrains: '🌾',
};
