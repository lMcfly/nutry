/**
 * Questions du profil, partagées par l'onboarding et l'écran Profil
 * (mêmes composants, mêmes libellés).
 */
import { ACTIVITY_LEVELS, GOALS, SEXES } from '@domain/profile';
import type { HealthSummary } from '@application/usecases';
import { ALLERGENS, FOOD_PREFERENCE_CHIPS, LEVELS } from '@domain/recipe';
import { ChipGroup, RadioGroup } from '../../components/Choice';
import type { ChoiceOption } from '../../components/Choice';
import { Field } from '../../components/Field';
import { Notice } from '../../components/Notice';
import { Stepper } from '../../components/Stepper';
import { Toggle } from '../../components/Toggle';
import {
  ACTIVITY_EMOJIS,
  ACTIVITY_HINTS,
  ACTIVITY_LABELS,
  ALLERGEN_LABELS,
  DIET_LABELS,
  GOAL_EMOJIS,
  GOAL_HINTS,
  GOAL_LABELS,
  LEVEL_EMOJIS,
  LEVEL_HINTS,
  LEVEL_LABELS,
  SEX_LABELS,
  TIME_OPTIONS,
  formatMinutes,
  plural,
} from '../../i18n/labels';
import { DIET_BASES, DIET_EXTRAS, PLAUSIBLE_RANGES, lossBlockedReason } from './draft';
import type { AboutIssues, ProfileDraft } from './draft';
import styles from './ProfileSections.module.css';

export const ALLERGEN_TRACES_NOTICE =
  'Les traces (« peut contenir ») ne sont pas prises en compte : vérifie toujours les étiquettes.';

interface SectionProps {
  readonly draft: ProfileDraft;
  readonly onChange: (patch: Partial<ProfileDraft>) => void;
}

/* ---------- 1. Toi ---------- */

interface AboutSectionProps extends SectionProps {
  /** Erreurs affichées (après une tentative de validation). */
  readonly issues: AboutIssues;
}

export function AboutSection({ draft, onChange, issues }: AboutSectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.grid2}>
        <Field
          label="Âge"
          min={PLAUSIBLE_RANGES.age[0]}
          max={PLAUSIBLE_RANGES.age[1]}
          inputMode="numeric"
          autoComplete="off"
          suffix="ans"
          value={draft.age}
          error={issues.age}
          onChange={(e) => {
            onChange({ age: e.target.value });
          }}
        />
        <Field
          label="Taille"
          min={PLAUSIBLE_RANGES.heightCm[0]}
          max={PLAUSIBLE_RANGES.heightCm[1]}
          inputMode="numeric"
          autoComplete="off"
          suffix="cm"
          value={draft.heightCm}
          error={issues.heightCm}
          onChange={(e) => {
            onChange({ heightCm: e.target.value });
          }}
        />
        <Field
          label="Poids"
          min={PLAUSIBLE_RANGES.weightKg[0]}
          max={PLAUSIBLE_RANGES.weightKg[1]}
          inputMode="decimal"
          autoComplete="off"
          suffix="kg"
          value={draft.weightKg}
          error={issues.weightKg}
          onChange={(e) => {
            onChange({ weightKg: e.target.value });
          }}
        />
        <Field
          label="Tour de taille"
          min={PLAUSIBLE_RANGES.waistCm[0]}
          max={PLAUSIBLE_RANGES.waistCm[1]}
          hint="Facultatif"
          inputMode="decimal"
          autoComplete="off"
          suffix="cm"
          value={draft.waistCm}
          error={issues.waistCm}
          onChange={(e) => {
            onChange({ waistCm: e.target.value });
          }}
        />
      </div>

      <div>
        <RadioGroup
          legend="Sexe"
          layout="segmented"
          options={SEXES.map((s) => ({ value: s, label: SEX_LABELS[s] }))}
          value={draft.sex}
          onChange={(sex) => {
            onChange({ sex });
          }}
        />
        {issues.sex && (
          <p className={styles.error} role="alert">
            {issues.sex}
          </p>
        )}
      </div>

      {draft.sex !== undefined && draft.sex !== 'homme' && (
        <Toggle
          label="Enceinte ou allaitante"
          hint="On adapte les recettes (ni alcool, ni cru)."
          checked={draft.pregnantOrBreastfeeding}
          onChange={(pregnantOrBreastfeeding) => {
            onChange({ pregnantOrBreastfeeding });
          }}
        />
      )}

      <RadioGroup
        legend="Ton activité au quotidien"
        layout="cards"
        options={ACTIVITY_LEVELS.map((a) => ({
          value: a,
          label: ACTIVITY_LABELS[a],
          hint: ACTIVITY_HINTS[a],
          emoji: ACTIVITY_EMOJIS[a],
        }))}
        value={draft.activity}
        onChange={(activity) => {
          onChange({ activity });
        }}
      />

      <Toggle
        label="As-tu une condition de santé particulière ?"
        hint="Facultatif. Par exemple un diabète, un trouble alimentaire, une maladie rénale ou un traitement en cours. On restera tout en douceur."
        checked={draft.healthCondition}
        onChange={(healthCondition) => {
          onChange({ healthCondition });
        }}
      />
    </div>
  );
}

/* ---------- 2. Objectif, régimes, allergies ---------- */

interface GoalSectionProps extends SectionProps {
  /** Garde-fous calculés en direct (`previewProfile`) ; absent si « Toi » est incomplet. */
  readonly health: HealthSummary | undefined;
}

export function GoalSection({ draft, onChange, health }: GoalSectionProps) {
  const lossAllowed = health?.lossAllowed ?? true;
  const reason = health ? lossBlockedReason(health) : undefined;
  const goal = !lossAllowed && draft.goal === 'perdre-en-douceur' ? 'reequilibrer' : draft.goal;
  const goalOptions: ChoiceOption<(typeof GOALS)[number]>[] = GOALS.map((g) => ({
    value: g,
    label: GOAL_LABELS[g],
    hint: g === 'perdre-en-douceur' && !lossAllowed ? 'Pas proposé pour ton profil' : GOAL_HINTS[g],
    emoji: GOAL_EMOJIS[g],
    disabled: g === 'perdre-en-douceur' && !lossAllowed,
  }));
  return (
    <div className={styles.section}>
      <div className={styles.stack}>
        <RadioGroup
          legend="Ton objectif"
          layout="cards"
          options={goalOptions}
          value={goal}
          onChange={(value) => {
            onChange({ goal: value });
          }}
        />
        {reason !== undefined && (
          <Notice tone="accent" emoji="💛">
            {reason}
          </Notice>
        )}
      </div>

      <RadioGroup
        legend="Ton alimentation"
        options={DIET_BASES.map((d) => ({ value: d, label: DIET_LABELS[d] }))}
        value={draft.dietBase}
        onChange={(dietBase) => {
          onChange({ dietBase });
        }}
      />

      <ChipGroup
        legend="Sans…"
        hint="Facultatif"
        options={DIET_EXTRAS.map((d) => ({ value: d, label: DIET_LABELS[d] }))}
        selected={draft.dietExtras}
        onChange={(dietExtras) => {
          onChange({ dietExtras });
        }}
      />

      <div className={styles.stack}>
        <ChipGroup
          legend="Allergies"
          hint="Les plats qui en contiennent ne seront jamais proposés."
          options={ALLERGENS.map((a) => ({ value: a, label: ALLERGEN_LABELS[a] }))}
          selected={draft.allergens}
          onChange={(allergens) => {
            onChange({ allergens });
          }}
        />
        <Notice tone="warning" emoji="🏷️">
          {ALLERGEN_TRACES_NOTICE}
        </Notice>
      </div>
    </div>
  );
}

/* ---------- 3. Goûts ---------- */

const FOOD_OPTIONS = FOOD_PREFERENCE_CHIPS.map((c) => ({
  value: c.term,
  label: c.label,
  emoji: c.emoji,
}));

export function TastesSection({ draft, onChange }: SectionProps) {
  return (
    <div className={styles.section}>
      <ChipGroup
        legend="J’adore 😋"
        hint="On te les proposera plus souvent."
        options={FOOD_OPTIONS}
        selected={draft.likes}
        onChange={(likes) => {
          onChange({ likes, dislikes: draft.dislikes.filter((d) => !likes.includes(d)) });
        }}
      />
      <ChipGroup
        legend="Je n’aime pas 🙅"
        hint="Tu ne les verras plus dans ton menu."
        options={FOOD_OPTIONS}
        selected={draft.dislikes}
        onChange={(dislikes) => {
          onChange({ dislikes, likes: draft.likes.filter((l) => !dislikes.includes(l)) });
        }}
      />
    </div>
  );
}

/* ---------- 4. Organisation ---------- */

const timeOptions = TIME_OPTIONS.map((m) => ({ value: String(m), label: formatMinutes(m) }));
const levelOptions = LEVELS.map((l) => ({
  value: l,
  label: LEVEL_LABELS[l],
  hint: LEVEL_HINTS[l],
  emoji: LEVEL_EMOJIS[l],
}));

export function OrganisationSection({ draft, onChange }: SectionProps) {
  return (
    <div className={styles.section}>
      <Stepper
        label="Combien êtes-vous à table ?"
        value={draft.householdSize}
        min={1}
        max={12}
        format={(n) => plural(n, 'personne')}
        decrementLabel="Une personne de moins"
        incrementLabel="Une personne de plus"
        onChange={(householdSize) => {
          onChange({ householdSize });
        }}
      />

      <RadioGroup
        legend="Temps pour cuisiner en semaine"
        options={timeOptions}
        value={String(draft.weekdayMinutes)}
        onChange={(v) => {
          onChange({ weekdayMinutes: Number(v) });
        }}
      />
      <RadioGroup
        legend="Temps pour cuisiner le week-end"
        options={timeOptions}
        value={String(draft.weekendMinutes)}
        onChange={(v) => {
          onChange({ weekendMinutes: Number(v) });
        }}
      />

      <RadioGroup
        legend="Niveau en semaine"
        layout="cards"
        options={levelOptions}
        value={draft.weekdayLevel}
        onChange={(weekdayLevel) => {
          onChange({ weekdayLevel });
        }}
      />
      <RadioGroup
        legend="Niveau le week-end"
        layout="cards"
        options={levelOptions}
        value={draft.weekendLevel}
        onChange={(weekendLevel) => {
          onChange({ weekendLevel });
        }}
      />

      <div>
        <Toggle
          label="Petit-déjeuner"
          hint="Ajoute une idée chaque matin."
          checked={draft.breakfast}
          onChange={(breakfast) => {
            onChange({ breakfast });
          }}
        />
        <Toggle
          label="Batch cooking du dimanche"
          hint="Prépare quelques plats d’avance pour gagner du temps."
          checked={draft.batchCooking}
          onChange={(batchCooking) => {
            onChange({ batchCooking });
          }}
        />
      </div>
    </div>
  );
}
