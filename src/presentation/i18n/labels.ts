/**
 * Libellés français des identifiants du domain (qui restent en ASCII kebab-case).
 * `labels.test.ts` vérifie qu'aucune valeur des vocabulaires du domain n'est oubliée.
 */
import type { CompanionItem } from '@domain/companion';
import type { DayIndex, MealSlot } from '@domain/mealplan';
import type { RatingReason } from '@domain/preferences';
import type { ActivityLevel, Goal, Sex } from '@domain/profile';
import type { QuizCategory } from '@domain/quiz';
import type { Aisle, Allergen, Diet, Level, ProteinType } from '@domain/recipe';
import type { ShoppingSectionKey } from '@domain/shopping';
import type { Theme } from '@domain/userdata';
import type { HouseholdKind } from '../features/training/figure/exerciseFigure';
import type {
  EffortFeeling,
  Equipment,
  EquipmentSetting,
  MuscleGroup,
  PregnancyStage,
  ProgressionAdvice,
  SessionDuration,
  SportAccessoryUnlock,
  TrainingFrequency,
  TrainingGoal,
  TrainingLevel,
} from '@domain/training';

export const LEVEL_LABELS: Readonly<Record<Level, string>> = {
  simple: 'Simple',
  medium: 'Médium',
  experiment: 'Expérimenter',
};

export const LEVEL_HINTS: Readonly<Record<Level, string>> = {
  simple: '20 min max, 6 ingrédients au plus, aucune technique.',
  medium: '20 à 45 min, quelques étapes de plus.',
  experiment: 'Des saveurs du monde et des gestes nouveaux.',
};

export const LEVEL_EMOJIS: Readonly<Record<Level, string>> = {
  simple: '🌱',
  medium: '🍲',
  experiment: '✨',
};

export const DIET_LABELS: Readonly<Record<Diet, string>> = {
  omnivore: 'Omnivore',
  flexitarien: 'Flexitarien',
  vegetarien: 'Végétarien',
  vegan: 'Végan',
  'sans-gluten': 'Sans gluten',
  'sans-lactose': 'Sans lactose',
};

export const ALLERGEN_LABELS: Readonly<Record<Allergen, string>> = {
  gluten: 'Gluten',
  crustaces: 'Crustacés',
  oeufs: 'Œufs',
  poissons: 'Poissons',
  arachides: 'Arachides',
  soja: 'Soja',
  lait: 'Lait',
  'fruits-a-coque': 'Fruits à coque',
  celeri: 'Céleri',
  moutarde: 'Moutarde',
  sesame: 'Sésame',
  sulfites: 'Sulfites',
  lupin: 'Lupin',
  mollusques: 'Mollusques',
};

export const PROTEIN_LABELS: Readonly<Record<ProteinType, string>> = {
  boeuf: 'Bœuf',
  porc: 'Porc',
  volaille: 'Volaille',
  agneau: 'Agneau',
  poisson: 'Poisson',
  'fruits-de-mer': 'Fruits de mer',
  oeufs: 'Œufs',
  legumineuses: 'Légumineuses',
  'soja-tofu': 'Soja et tofu',
  fromage: 'Fromage',
  aucune: 'Végétal',
};

export const AISLE_LABELS: Readonly<Record<Aisle, string>> = {
  'fruits-legumes': 'Fruits et légumes',
  'boucherie-poissonnerie': 'Boucherie et poissonnerie',
  frais: 'Frais',
  boulangerie: 'Boulangerie',
  epicerie: 'Épicerie',
  surgeles: 'Surgelés',
};

export const SECTION_EMOJIS: Readonly<Record<ShoppingSectionKey, string>> = {
  'fruits-legumes': '🥕',
  'boucherie-poissonnerie': '🐟',
  frais: '🧀',
  boulangerie: '🥖',
  epicerie: '🫙',
  surgeles: '❄️',
  divers: '🧺',
};

export const SECTION_TITLES: Readonly<Record<ShoppingSectionKey, string>> = {
  ...AISLE_LABELS,
  divers: 'Divers',
};

export const SEX_LABELS: Readonly<Record<Sex, string>> = {
  femme: 'Femme',
  homme: 'Homme',
  autre: 'Autre',
};

export const SEX_EMOJIS: Readonly<Record<Sex, string>> = {
  femme: '🙋‍♀️',
  homme: '🙋‍♂️',
  autre: '🙋',
};

export const DIET_EMOJIS: Readonly<Record<Diet, string>> = {
  omnivore: '🍽️',
  flexitarien: '🥗',
  vegetarien: '🥕',
  vegan: '🌱',
  'sans-gluten': '🌾',
  'sans-lactose': '🥛',
};

export const DIET_HINTS: Readonly<Partial<Record<Diet, string>>> = {
  omnivore: 'De tout, sans restriction',
  flexitarien: 'Surtout végétal, un peu de viande ou de poisson',
  vegetarien: 'Pas de viande ni de poisson',
  vegan: 'Aucun produit animal',
};

export const ALLERGEN_EMOJIS: Readonly<Record<Allergen, string>> = {
  gluten: '🌾',
  crustaces: '🦐',
  oeufs: '🥚',
  poissons: '🐟',
  arachides: '🥜',
  soja: '🫘',
  lait: '🥛',
  'fruits-a-coque': '🌰',
  celeri: '🥬',
  moutarde: '🟡',
  sesame: '🌱',
  sulfites: '🍷',
  lupin: '🌼',
  mollusques: '🐚',
};

/** Emoji d'une durée de cuisine proposée (TIME_OPTIONS). */
export const TIME_EMOJIS: Readonly<Record<number, string>> = {
  15: '⚡',
  20: '🍳',
  30: '🥘',
  45: '🍲',
  60: '👩‍🍳',
  90: '🫕',
};

export const YES_NO_LABELS = { yes: 'Oui', no: 'Non' } as const;

export const ACTIVITY_LABELS: Readonly<Record<ActivityLevel, string>> = {
  sedentaire: 'Sédentaire',
  leger: 'Un peu actif',
  modere: 'Actif',
  actif: 'Très actif',
  'tres-actif': 'Sportif',
};

export const ACTIVITY_HINTS: Readonly<Record<ActivityLevel, string>> = {
  sedentaire: 'Surtout assis, peu de marche',
  leger: 'Marche ou sport léger 1 à 3 fois par semaine',
  modere: 'Sport 3 à 5 fois par semaine',
  actif: 'Sport intense 6 à 7 fois par semaine',
  'tres-actif': 'Métier physique ou entraînement quotidien',
};

export const ACTIVITY_EMOJIS: Readonly<Record<ActivityLevel, string>> = {
  sedentaire: '🛋️',
  leger: '🚶',
  modere: '🚴',
  actif: '🏃',
  'tres-actif': '🏋️',
};

export const GOAL_LABELS: Readonly<Record<Goal, string>> = {
  reequilibrer: 'Rééquilibrer',
  'perdre-en-douceur': 'Perdre en douceur',
  maintenir: 'Maintenir',
  energie: 'Reprendre de l’énergie',
};

export const GOAL_HINTS: Readonly<Record<Goal, string>> = {
  reequilibrer: 'Des assiettes variées et de saison',
  'perdre-en-douceur': 'Des portions un peu ajustées, sans frustration',
  maintenir: 'Garder ton équilibre actuel',
  energie: 'Des repas qui donnent la pêche',
};

export const GOAL_EMOJIS: Readonly<Record<Goal, string>> = {
  reequilibrer: '⚖️',
  'perdre-en-douceur': '🍃',
  maintenir: '🌿',
  energie: '⚡',
};

export const RATING_REASON_LABELS: Readonly<Record<RatingReason, string>> = {
  'trop-long': 'Trop long',
  'pas-aime': 'Pas aimé le goût',
  'trop-copieux': 'Trop copieux',
  autre: 'Autre',
};

export const SLOT_LABELS: Readonly<Record<MealSlot, string>> = {
  'petit-dejeuner': 'Petit-déjeuner',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
};

export const DAY_LABELS: Readonly<Record<DayIndex, string>> = {
  0: 'Lundi',
  1: 'Mardi',
  2: 'Mercredi',
  3: 'Jeudi',
  4: 'Vendredi',
  5: 'Samedi',
  6: 'Dimanche',
};

/** Libellés courts des créneaux (onglets). */
export const SLOT_SHORT_LABELS: Readonly<Record<MealSlot, string>> = {
  'petit-dejeuner': 'Petit-déj',
  dejeuner: 'Déjeuner',
  diner: 'Dîner',
};

/** Jours abrégés du bandeau de la semaine. */
export const DAY_SHORT_LABELS: Readonly<Record<DayIndex, string>> = {
  0: 'Lun',
  1: 'Mar',
  2: 'Mer',
  3: 'Jeu',
  4: 'Ven',
  5: 'Sam',
  6: 'Dim',
};

/** Libellés courts des rayons (puces de la liste de courses). */
export const SECTION_SHORT_LABELS: Readonly<Record<ShoppingSectionKey, string>> = {
  'fruits-legumes': 'Fruits et légumes',
  'boucherie-poissonnerie': 'Viandes et poissons',
  frais: 'Frais',
  boulangerie: 'Boulangerie',
  epicerie: 'Épicerie',
  surgeles: 'Surgelés',
  divers: 'Divers',
};

export const SLOT_EMOJIS: Readonly<Record<MealSlot, string>> = {
  'petit-dejeuner': '☕',
  dejeuner: '☀️',
  diner: '🌙',
};

export const QUIZ_CATEGORY_LABELS: Readonly<Record<QuizCategory, string>> = {
  histoire: 'Histoire',
  geographie: 'Géographie',
  sciences: 'Sciences',
  arts: 'Arts',
  sport: 'Sport',
  nature: 'Nature',
  cuisine: 'Cuisine',
};

export const THEME_LABELS: Readonly<Record<Theme, string>> = {
  system: 'Comme mon téléphone',
  light: 'Clair',
  dark: 'Sombre',
};

/**
 * Éléments du catalogue de Nutry, avec leur article (« la toque de chef ») pour les phrases
 * « Encore 3 jours pour la toque de chef ! » et « Nutry a gagné la toque de chef ! ».
 */
export const UNLOCK_PHRASES: Readonly<Record<string, string>> = {
  feuille: 'la feuille sur la tête',
  'lunettes-rondes': 'les lunettes rondes',
  'toque-de-chef': 'la toque de chef',
  echarpe: 'l’écharpe',
  tablier: 'le tablier',
  bonnet: 'le bonnet',
  'couronne-de-fruits': 'la couronne de fruits',
  bandeau: 'le bandeau',
  serviette: 'la serviette',
  casquette: 'la casquette',
  medaille: 'la médaille',
  aurore: 'la teinte Aurore',
  cosmos: 'la teinte Cosmos',
  'arc-en-ciel': 'la teinte Arc-en-ciel',
};

/** « 5 jours de série » ou « 5 séances » : ce qui débloque un élément de Nutry. */
export function unlockCondition(item: CompanionItem): string {
  return item.unlockAt.kind === 'serie'
    ? `${plural(item.unlockAt.days, 'jour')} de série`
    : plural(item.unlockAt.count, 'séance');
}

/** « à 5 jours » ou « à 5 séances » (bulle verrouillée). */
export function unlockHint(item: CompanionItem): string {
  return `à ${
    item.unlockAt.kind === 'serie'
      ? plural(item.unlockAt.days, 'jour')
      : plural(item.unlockAt.count, 'séance')
  }`;
}

/** « la toque de chef » (sinon le libellé du catalogue en minuscules). */
export function unlockPhrase(item: CompanionItem): string {
  return UNLOCK_PHRASES[item.id] ?? item.label.toLowerCase();
}

/** « la toque de chef et l’écharpe ». */
export function joinPhrases(phrases: readonly string[]): string {
  if (phrases.length <= 1) return phrases.join('');
  return `${phrases.slice(0, -1).join(', ')} et ${phrases.at(-1) ?? ''}`;
}

/** Citation de la source des valeurs nutritionnelles (Confidentialité, détail recette). */
export const CIQUAL_CITATION =
  'Anses. 2025. Table de composition nutritionnelle des aliments Ciqual';

/** Durées proposées par repas (minutes). */
export const TIME_OPTIONS = [15, 20, 30, 45, 60, 90] as const;

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

const DATE_LONG = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
const DATE_SHORT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const DATE_FULL = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const toDate = (iso: string): Date => new Date(`${iso.slice(0, 10)}T00:00:00Z`);
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** « Lundi 23 novembre ». */
export function formatDayLong(iso: string): string {
  return capitalize(DATE_LONG.format(toDate(iso)));
}

/** « 23 » (jour du mois). */
export function formatDayOfMonth(iso: string): string {
  return String(toDate(iso).getUTCDate());
}

/** « 23 nov. ». */
export function formatDayShort(iso: string): string {
  return DATE_SHORT.format(toDate(iso));
}

/** « 23 novembre 2026 ». */
export function formatDateFull(iso: string): string {
  return DATE_FULL.format(toDate(iso));
}

/** Nombre décimal à la française (« 72,5 »). */
export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: digits });
}

/** Accord simple : « 1 repas », « 2 personnes ». */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

// ---------------------------------------------------------------- Sport (ADR 0015)

export const MUSCLE_GROUP_LABELS: Readonly<Record<MuscleGroup, string>> = {
  pectoraux: 'Pectoraux',
  dos: 'Dos',
  epaules: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  abdominaux: 'Abdominaux',
  lombaires: 'Lombaires',
  fessiers: 'Fessiers',
  quadriceps: 'Quadriceps',
  'ischio-jambiers': 'Ischio-jambiers',
  mollets: 'Mollets',
};

export const EQUIPMENT_LABELS: Readonly<Record<Equipment, string>> = {
  tapis: 'Tapis',
  halteres: 'Haltères',
  elastique: 'Élastique',
  kettlebell: 'Kettlebell',
  barre: 'Barre',
  'barre-ez': 'Barre EZ',
  banc: 'Banc',
  'banc-incline': 'Banc inclinable',
  'barre-traction': 'Barre de traction',
  poulie: 'Poulie',
  'swiss-ball': 'Swiss ball',
  machine: 'Machines guidées',
};

/** À avoir sous la main sans rien acheter (accessoires du foyer dessinés par le mannequin). */
export const HOUSEHOLD_LABELS: Readonly<Record<HouseholdKind, string>> = {
  mur: 'Un mur',
  chaise: 'Une chaise stable',
  table: 'Une table ou un meuble stable',
  step: 'Une marche stable',
  banc: 'Un banc ou un canapé',
  serviette: 'Une serviette',
  'sac-a-dos': 'Un sac à dos chargé',
  bouteilles: 'Deux bouteilles d’eau',
  sliders: 'Des sliders ou des serviettes',
  coussin: 'Un coussin ferme',
};

export const HOUSEHOLD_EMOJIS: Readonly<Record<HouseholdKind, string>> = {
  mur: '🧱',
  chaise: '🪑',
  table: '🪵',
  step: '🪜',
  banc: '🛋️',
  serviette: '🧻',
  'sac-a-dos': '🎒',
  bouteilles: '🧴',
  sliders: '🧦',
  coussin: '🛋️',
};

export const EQUIPMENT_EMOJIS: Readonly<Record<Equipment, string>> = {
  tapis: '🧘',
  halteres: '🏋️',
  elastique: '🪢',
  kettlebell: '🔔',
  barre: '🏋️‍♀️',
  'barre-ez': '〰️',
  banc: '🪑',
  'banc-incline': '📐',
  'barre-traction': '🧗',
  poulie: '🛞',
  'swiss-ball': '⚪',
  machine: '⚙️',
};

export const EQUIPMENT_SETTING_EMOJIS: Readonly<Record<EquipmentSetting, string>> = {
  maison: '🏠',
  'maison-equipee': '🏡',
  salle: '🏋️',
};

export const TRAINING_LEVEL_EMOJIS: Readonly<Record<TrainingLevel, string>> = {
  debutant: '🌱',
  intermediaire: '🌿',
  confirme: '🌳',
};

export const TRAINING_GOAL_EMOJIS: Readonly<Record<TrainingGoal, string>> = {
  forme: '☀️',
  force: '💪',
  muscle: '🏋️',
  endurance: '🚴',
};

export const TRAINING_FREQUENCY_EMOJIS: Readonly<Record<TrainingFrequency, string>> = {
  1: '🌱',
  2: '🌿',
  3: '🍀',
  4: '🌳',
  5: '🔥',
  6: '⚡',
};

export const SESSION_DURATION_EMOJIS: Readonly<Record<SessionDuration, string>> = {
  20: '⏱️',
  30: '🕒',
  45: '🕓',
  60: '🕐',
};

export const PREGNANCY_STAGE_EMOJIS: Readonly<Record<PregnancyStage, string>> = {
  'premier-trimestre': '🌱',
  'apres-premier-trimestre': '🤰',
  'post-partum': '👶',
};

export const EFFORT_LABELS: Readonly<Record<EffortFeeling, string>> = {
  facile: 'Facile',
  correct: 'Correct',
  difficile: 'Difficile',
};

export const EFFORT_EMOJIS: Readonly<Record<EffortFeeling, string>> = {
  facile: '😌',
  correct: '🙂',
  difficile: '😮‍💨',
};

/** Conseil de progression sous l'exercice (double progression, ADR 0015). */
export const PROGRESSION_ADVICE_LABELS: Readonly<Record<ProgressionAdvice, string>> = {
  'trouve-ta-charge': 'Trouve ta charge : garde 2 ou 3 répétitions en réserve',
  'ajoute-une-repetition': 'Essaie une répétition de plus que la dernière fois',
  'augmente-la-charge': 'Tu peux prendre un peu plus lourd',
  maintiens: 'Garde la même charge, en douceur',
  allege: 'On allège un peu pour mieux repartir',
  'variante-plus-dure': 'La variante plus difficile t’attend',
  'semaine-allegee': 'Semaine allégée : vas-y tranquillement',
};

/** Emoji des accessoires sportifs de Nutry (récapitulatif de séance). */
export const SPORT_ACCESSORY_EMOJIS: Readonly<Record<SportAccessoryUnlock['id'], string>> = {
  bandeau: '🎽',
  serviette: '🧣',
  casquette: '🧢',
  medaille: '🏅',
};

/** Accessoire sportif avec son article (« le bandeau »). */
export const SPORT_ACCESSORY_PHRASES: Readonly<Record<SportAccessoryUnlock['id'], string>> = {
  bandeau: 'le bandeau',
  serviette: 'la serviette',
  casquette: 'la casquette',
  medaille: 'la médaille',
};

/** Espace fine insécable avant « ? » et « ! » (le signe ne part jamais seul à la ligne). */
export function frenchPunctuation(text: string): string {
  return text.replace(/ ([?!:;])/g, '\u202f$1');
}

/** « 1 min 30 », « 45 s », « 2 min ». */
export function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${m} min` : `${m} min ${String(rest).padStart(2, '0')}`;
}

/** Minuteur « 1:05 ». */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Charge à la française : « 7,5 kg ». */
export function formatKg(kg: number): string {
  return `${formatDecimal(kg)} kg`;
}
