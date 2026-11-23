import type { HealthSummary } from '@application/usecases';
import { PROFILE_BOUNDS } from '@domain/profile';
import type { ActivityLevel, Goal, Profile, ProfileIssue, Sex } from '@domain/profile';
import type { Allergen, Diet, Level } from '@domain/recipe';

/** Régime principal (choix unique) ; « sans gluten / sans lactose » se cumulent. */
export const DIET_BASES = ['omnivore', 'flexitarien', 'vegetarien', 'vegan'] as const;
export type DietBase = (typeof DIET_BASES)[number];
export const DIET_EXTRAS = ['sans-gluten', 'sans-lactose'] as const;
export type DietExtra = (typeof DIET_EXTRAS)[number];

/** Réponses en cours de saisie : les nombres restent du texte tant qu'on tape. */
export interface ProfileDraft {
  readonly age: string;
  readonly sex: Sex | undefined;
  readonly heightCm: string;
  readonly weightKg: string;
  readonly waistCm: string;
  readonly activity: ActivityLevel;
  readonly pregnantOrBreastfeeding: boolean;
  readonly healthCondition: boolean;
  readonly goal: Goal;
  readonly dietBase: DietBase;
  readonly dietExtras: readonly DietExtra[];
  readonly allergens: readonly Allergen[];
  readonly likes: readonly string[];
  readonly dislikes: readonly string[];
  readonly householdSize: number;
  readonly weekdayMinutes: number;
  readonly weekendMinutes: number;
  readonly weekdayLevel: Level;
  readonly weekendLevel: Level;
  readonly breakfast: boolean;
  readonly batchCooking: boolean;
}

/** Valeurs par défaut sensées : on ne devine jamais l'âge, la taille ou le poids. */
export const DEFAULT_DRAFT: ProfileDraft = {
  age: '',
  sex: undefined,
  heightCm: '',
  weightKg: '',
  waistCm: '',
  activity: 'leger',
  pregnantOrBreastfeeding: false,
  healthCondition: false,
  goal: 'reequilibrer',
  dietBase: 'omnivore',
  dietExtras: [],
  allergens: [],
  likes: [],
  dislikes: [],
  householdSize: 1,
  weekdayMinutes: 30,
  weekendMinutes: 60,
  weekdayLevel: 'simple',
  weekendLevel: 'medium',
  breakfast: false,
  batchCooking: false,
};

export type AboutField = 'age' | 'sex' | 'heightCm' | 'weightKg' | 'waistCm';
export type AboutIssues = Partial<Record<AboutField, string>>;

/** Bornes de saisie : celles du domain (`PROFILE_BOUNDS`), validées par `saveProfile`. */
export const PLAUSIBLE_RANGES: Readonly<
  Record<Exclude<AboutField, 'sex'>, readonly [number, number]>
> = {
  age: [PROFILE_BOUNDS.age.min, PROFILE_BOUNDS.age.max],
  heightCm: [PROFILE_BOUNDS.heightCm.min, PROFILE_BOUNDS.heightCm.max],
  weightKg: [PROFILE_BOUNDS.weightKg.min, PROFILE_BOUNDS.weightKg.max],
  waistCm: [PROFILE_BOUNDS.waistCm.min, PROFILE_BOUNDS.waistCm.max],
};

const UNITS: Readonly<Record<Exclude<AboutField, 'sex'>, string>> = {
  age: 'ans',
  heightCm: 'cm',
  weightKg: 'kg',
  waistCm: 'cm',
};

/** « 72,5 » ou « 72.5 » → 72.5 ; vide ou invalide → undefined. */
export function parseDecimal(raw: string): number | undefined {
  const text = raw.trim().replace(',', '.');
  if (text === '') return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function checkNumber(
  field: Exclude<AboutField, 'sex'>,
  raw: string,
  required: boolean,
): string | undefined {
  const value = parseDecimal(raw);
  if (value === undefined) {
    if (raw.trim() !== '') return 'Indique un nombre.';
    return required ? 'Ce champ nous aide à ajuster tes portions.' : undefined;
  }
  const [min, max] = PLAUSIBLE_RANGES[field];
  if (value < min || value > max) {
    return `Vérifie cette valeur : entre ${min} et ${max} ${UNITS[field]}.`;
  }
  if (field === 'age' && !Number.isInteger(value)) return 'Indique ton âge en années.';
  return undefined;
}

/** Erreurs de l'écran « Toi » (vide si tout est bon). */
export function aboutIssues(draft: ProfileDraft): AboutIssues {
  const issues: Record<string, string> = {};
  for (const [field, required] of [
    ['age', true],
    ['heightCm', true],
    ['weightKg', true],
    ['waistCm', false],
  ] as const) {
    const message = checkNumber(field, draft[field], required);
    if (message) issues[field] = message;
  }
  if (!draft.sex) issues['sex'] = 'Choisis l’option qui te correspond.';
  return issues;
}

export function dietsOf(draft: Pick<ProfileDraft, 'dietBase' | 'dietExtras'>): Diet[] {
  return [...(draft.dietBase === 'omnivore' ? [] : [draft.dietBase]), ...draft.dietExtras];
}

/** Profil complet, ou `undefined` si l'écran « Toi » comporte des erreurs. */
export function draftToProfile(draft: ProfileDraft): Profile | undefined {
  if (Object.keys(aboutIssues(draft)).length > 0 || !draft.sex) return undefined;
  const waist = parseDecimal(draft.waistCm);
  const pregnancyRelevant = draft.sex !== 'homme';
  return {
    age: parseDecimal(draft.age) ?? 0,
    sex: draft.sex,
    heightCm: parseDecimal(draft.heightCm) ?? 0,
    weightKg: parseDecimal(draft.weightKg) ?? 0,
    ...(waist === undefined ? {} : { waistCm: waist }),
    activity: draft.activity,
    goal: draft.goal,
    diets: dietsOf(draft),
    allergens: [...draft.allergens],
    likes: [...draft.likes],
    dislikes: [...draft.dislikes],
    householdSize: draft.householdSize,
    weekdayMinutes: draft.weekdayMinutes,
    weekendMinutes: draft.weekendMinutes,
    weekdayLevel: draft.weekdayLevel,
    weekendLevel: draft.weekendLevel,
    breakfast: draft.breakfast,
    batchCooking: draft.batchCooking,
    pregnantOrBreastfeeding: pregnancyRelevant && draft.pregnantOrBreastfeeding,
    healthCondition: draft.healthCondition,
  };
}

const isDietBase = (d: Diet): d is DietBase => (DIET_BASES as readonly string[]).includes(d);
const isDietExtra = (d: Diet): d is DietExtra => (DIET_EXTRAS as readonly string[]).includes(d);

/** Réponses pré-remplies à partir d'un profil enregistré (écran Profil). */
export function draftFromProfile(profile: Profile): ProfileDraft {
  // Le régime le plus restrictif l'emporte s'il y en a plusieurs.
  const bases = profile.diets.filter(isDietBase);
  const dietBase =
    [...DIET_BASES].reverse().find((b) => bases.includes(b) && b !== 'omnivore') ?? 'omnivore';
  return {
    age: String(profile.age),
    sex: profile.sex,
    heightCm: String(profile.heightCm),
    weightKg: String(profile.weightKg).replace('.', ','),
    waistCm: profile.waistCm === undefined ? '' : String(profile.waistCm).replace('.', ','),
    activity: profile.activity,
    pregnantOrBreastfeeding: profile.pregnantOrBreastfeeding,
    healthCondition: profile.healthCondition ?? false,
    goal: profile.goal,
    dietBase,
    dietExtras: profile.diets.filter(isDietExtra),
    allergens: profile.allergens,
    likes: profile.likes,
    dislikes: profile.dislikes,
    householdSize: profile.householdSize,
    weekdayMinutes: profile.weekdayMinutes,
    weekendMinutes: profile.weekendMinutes,
    weekdayLevel: profile.weekdayLevel,
    weekendLevel: profile.weekendLevel,
    breakfast: profile.breakfast,
    batchCooking: profile.batchCooking,
  };
}

/** Message expliquant pourquoi « perdre en douceur » est grisé. */
export function lossBlockedReason(health: HealthSummary): string | undefined {
  if (health.lossAllowed) return undefined;
  return health.messages.find((m) => m.code !== 'tour-de-taille')?.text;
}

/** Erreurs renvoyées par `saveProfile` (bornes du domain), rattachées aux champs de « Toi ». */
export function aboutIssuesFrom(issues: readonly ProfileIssue[]): AboutIssues {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    if (issue.field in PLAUSIBLE_RANGES) result[issue.field] = issue.message;
  }
  return result;
}
