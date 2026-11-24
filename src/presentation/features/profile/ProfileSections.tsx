/**
 * Questions du profil, partagées par l'onboarding (une question par écran, `variant="wizard"`)
 * et l'écran Profil (toutes les questions d'une partie en liste, `variant="list"`) : mêmes
 * composants, mêmes libellés (`PROFILE_QUESTIONS`, ADR 0010).
 */
import { ACTIVITY_LEVELS, GOALS, PROFILE_QUESTIONS, PROFILE_STEPS, SEXES } from '@domain/profile';
import type { ProfileQuestionId } from '@domain/profile';
import type { HealthSummary } from '@application/usecases';
import { ALLERGENS, FOOD_PREFERENCE_CHIPS, LEVELS } from '@domain/recipe';
import { ChipGroup, RadioGroup } from '../../components/Choice';
import type { ChoiceOption } from '../../components/Choice';
import { NumberDial } from '../../components/NumberDial';
import { Notice } from '../../components/Notice';
import { Toggle } from '../../components/Toggle';
import {
  ACTIVITY_EMOJIS,
  ACTIVITY_HINTS,
  ACTIVITY_LABELS,
  ALLERGEN_EMOJIS,
  ALLERGEN_LABELS,
  DIET_EMOJIS,
  DIET_HINTS,
  DIET_LABELS,
  GOAL_EMOJIS,
  GOAL_HINTS,
  GOAL_LABELS,
  LEVEL_EMOJIS,
  LEVEL_HINTS,
  LEVEL_LABELS,
  SEX_EMOJIS,
  SEX_LABELS,
  TIME_EMOJIS,
  TIME_OPTIONS,
  YES_NO_LABELS,
  formatMinutes,
} from '../../i18n/labels';
import { DIET_BASES, DIET_EXTRAS, PLAUSIBLE_RANGES, lossBlockedReason } from './draft';
import type { AboutIssues, ProfileDraft } from './draft';
import styles from './ProfileSections.module.css';
import { HeartIcon, InfoIcon } from '../../components/icons';

export const ALLERGEN_TRACES_NOTICE =
  'Les traces (« peut contenir ») ne sont pas prises en compte : vérifie toujours les étiquettes.';

export interface SectionProps {
  readonly draft: ProfileDraft;
  readonly onChange: (patch: Partial<ProfileDraft>) => void;
}

/** `wizard` : une question plein écran ; `list` : question parmi d'autres dans une feuille. */
export type QuestionVariant = 'wizard' | 'list';

interface QuestionInputProps extends SectionProps {
  readonly id: ProfileQuestionId;
  readonly variant: QuestionVariant;
  /** Erreurs affichées (après une tentative de validation). */
  readonly issues?: AboutIssues;
  /** Garde-fous calculés en direct (`previewProfile`) ; absent si les mesures sont incomplètes. */
  readonly health?: HealthSummary | undefined;
  /** Choix fait au doigt : l'onboarding passe à la question suivante. */
  readonly onPick?: () => void;
}

const timeOptions = TIME_OPTIONS.map((m) => ({
  value: String(m),
  label: formatMinutes(m),
  emoji: TIME_EMOJIS[m] ?? '⏱️',
}));
const levelOptions = LEVELS.map((l) => ({
  value: l,
  label: LEVEL_LABELS[l],
  hint: LEVEL_HINTS[l],
  emoji: LEVEL_EMOJIS[l],
}));
const FOOD_OPTIONS = FOOD_PREFERENCE_CHIPS.map((c) => ({
  value: c.term,
  label: c.label,
  emoji: c.emoji,
}));

type YesNo = 'oui' | 'non';
const yesNoOptions: readonly ChoiceOption<YesNo>[] = [
  { value: 'oui', label: YES_NO_LABELS.yes, emoji: '👍' },
  { value: 'non', label: YES_NO_LABELS.no, emoji: '🙅' },
];

/** Une question du profil, dans la présentation qui convient (grand chiffre, cartes, nuage). */
export function QuestionInput({
  id,
  draft,
  onChange,
  variant,
  issues = {},
  health,
  onPick,
}: QuestionInputProps) {
  const text = PROFILE_QUESTIONS[id];
  const wizard = variant === 'wizard';

  /** Booléen : grandes cartes Oui / Non à l'onboarding, interrupteur dans les feuilles. */
  const yesNo = (value: boolean, set: (v: boolean) => void) =>
    wizard ? (
      <RadioGroup
        legend={text.prompt}
        hideLegend
        layout="tiles"
        options={yesNoOptions}
        value={value ? 'oui' : 'non'}
        onPick={() => onPick?.()}
        onChange={(v) => {
          set(v === 'oui');
        }}
      />
    ) : (
      <Toggle label={text.label} hint={text.hint} checked={value} onChange={set} />
    );

  switch (id) {
    case 'age':
      return (
        <NumberDial
          label={text.label}
          compact={!wizard}
          min={PLAUSIBLE_RANGES.age[0]}
          max={PLAUSIBLE_RANGES.age[1]}
          start={30}
          unit="ans"
          value={draft.age}
          error={issues.age}
          onChange={(age) => {
            onChange({ age });
          }}
        />
      );
    case 'height':
      return (
        <NumberDial
          label={text.label}
          compact={!wizard}
          min={PLAUSIBLE_RANGES.heightCm[0]}
          max={PLAUSIBLE_RANGES.heightCm[1]}
          start={170}
          unit="cm"
          value={draft.heightCm}
          error={issues.heightCm}
          onChange={(heightCm) => {
            onChange({ heightCm });
          }}
        />
      );
    case 'weight':
      return (
        <NumberDial
          label={text.label}
          compact={!wizard}
          decimal
          step={0.5}
          min={PLAUSIBLE_RANGES.weightKg[0]}
          max={PLAUSIBLE_RANGES.weightKg[1]}
          start={70}
          unit="kg"
          value={draft.weightKg}
          error={issues.weightKg}
          onChange={(weightKg) => {
            onChange({ weightKg });
          }}
        />
      );
    case 'waist':
      return (
        <NumberDial
          label={text.label}
          compact={!wizard}
          decimal
          step={1}
          min={PLAUSIBLE_RANGES.waistCm[0]}
          max={PLAUSIBLE_RANGES.waistCm[1]}
          start={80}
          unit="cm"
          {...(wizard ? {} : { hint: text.hint ?? '' })}
          value={draft.waistCm}
          error={issues.waistCm}
          onChange={(waistCm) => {
            onChange({ waistCm });
          }}
        />
      );
    case 'sex':
      return (
        <div>
          <RadioGroup
            legend={text.label}
            hideLegend={wizard}
            layout={wizard ? 'tiles' : 'segmented'}
            options={SEXES.map((s) => ({
              value: s,
              label: SEX_LABELS[s],
              ...(wizard ? { emoji: SEX_EMOJIS[s] } : {}),
            }))}
            value={draft.sex}
            onPick={() => onPick?.()}
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
      );
    case 'pregnancy':
      return yesNo(draft.pregnantOrBreastfeeding, (pregnantOrBreastfeeding) => {
        onChange({ pregnantOrBreastfeeding });
      });
    case 'activity':
      return (
        <RadioGroup
          legend={text.label}
          hideLegend={wizard}
          layout="cards"
          options={ACTIVITY_LEVELS.map((a) => ({
            value: a,
            label: ACTIVITY_LABELS[a],
            hint: ACTIVITY_HINTS[a],
            emoji: ACTIVITY_EMOJIS[a],
          }))}
          value={draft.activity}
          onPick={() => onPick?.()}
          onChange={(activity) => {
            onChange({ activity });
          }}
        />
      );
    case 'healthCondition':
      return yesNo(draft.healthCondition, (healthCondition) => {
        onChange({ healthCondition });
      });
    case 'goal': {
      const lossAllowed = health?.lossAllowed ?? true;
      const reason = health ? lossBlockedReason(health) : undefined;
      const goal = !lossAllowed && draft.goal === 'perdre-en-douceur' ? 'reequilibrer' : draft.goal;
      const goalOptions: ChoiceOption<(typeof GOALS)[number]>[] = GOALS.map((g) => ({
        value: g,
        label: GOAL_LABELS[g],
        hint:
          g === 'perdre-en-douceur' && !lossAllowed ? 'Pas proposé pour ton profil' : GOAL_HINTS[g],
        emoji: GOAL_EMOJIS[g],
        disabled: g === 'perdre-en-douceur' && !lossAllowed,
      }));
      return (
        <div className={styles.stack}>
          <RadioGroup
            legend={text.label}
            hideLegend={wizard}
            layout="cards"
            options={goalOptions}
            value={goal}
            onPick={() => onPick?.()}
            onChange={(value) => {
              onChange({ goal: value });
            }}
          />
          {reason !== undefined && (
            <Notice tone="accent" emoji={<HeartIcon size={20} />}>
              {reason}
            </Notice>
          )}
        </div>
      );
    }
    case 'dietBase':
      return (
        <RadioGroup
          legend={text.label}
          hideLegend={wizard}
          layout="cards"
          options={DIET_BASES.map((d) => ({
            value: d,
            label: DIET_LABELS[d],
            emoji: DIET_EMOJIS[d],
            ...(DIET_HINTS[d] === undefined ? {} : { hint: DIET_HINTS[d] }),
          }))}
          value={draft.dietBase}
          onPick={() => onPick?.()}
          onChange={(dietBase) => {
            onChange({ dietBase });
          }}
        />
      );
    case 'dietExtras':
      return (
        <ChipGroup
          legend={text.label}
          hideLegend={wizard}
          {...(wizard ? {} : { hint: text.hint })}
          options={DIET_EXTRAS.map((d) => ({
            value: d,
            label: DIET_LABELS[d],
            emoji: DIET_EMOJIS[d],
          }))}
          selected={draft.dietExtras}
          onChange={(dietExtras) => {
            onChange({ dietExtras });
          }}
        />
      );
    case 'allergens':
      return (
        <div className={styles.stack}>
          <ChipGroup
            legend={text.label}
            hideLegend={wizard}
            {...(wizard ? {} : { hint: text.hint })}
            options={ALLERGENS.map((a) => ({
              value: a,
              label: ALLERGEN_LABELS[a],
              emoji: ALLERGEN_EMOJIS[a],
            }))}
            selected={draft.allergens}
            onChange={(allergens) => {
              onChange({ allergens });
            }}
          />
          <Notice tone="warning" emoji={<InfoIcon size={20} />}>
            {ALLERGEN_TRACES_NOTICE}
          </Notice>
        </div>
      );
    case 'likes':
      return (
        <ChipGroup
          legend={text.label}
          hideLegend={wizard}
          {...(wizard ? {} : { hint: text.hint })}
          options={FOOD_OPTIONS}
          selected={draft.likes}
          onChange={(likes) => {
            onChange({ likes, dislikes: draft.dislikes.filter((d) => !likes.includes(d)) });
          }}
        />
      );
    case 'dislikes':
      return (
        <ChipGroup
          legend={text.label}
          hideLegend={wizard}
          {...(wizard ? {} : { hint: text.hint })}
          options={FOOD_OPTIONS}
          selected={draft.dislikes}
          onChange={(dislikes) => {
            onChange({ dislikes, likes: draft.likes.filter((l) => !dislikes.includes(l)) });
          }}
        />
      );
    case 'household':
      return (
        <NumberDial
          label={text.label}
          compact={!wizard}
          noSlider
          min={1}
          max={12}
          start={1}
          unit={draft.householdSize > 1 ? 'personnes' : 'personne'}
          value={String(draft.householdSize)}
          decrementLabel="Une personne de moins"
          incrementLabel="Une personne de plus"
          onChange={(raw) => {
            const n = Number(raw.replace(/\D/g, ''));
            if (Number.isFinite(n) && n >= 1) onChange({ householdSize: Math.min(12, n) });
          }}
        />
      );
    case 'weekdayMinutes':
      return (
        <RadioGroup
          legend={text.label}
          hideLegend={wizard}
          layout={wizard ? 'tiles' : 'chips'}
          options={timeOptions}
          value={String(draft.weekdayMinutes)}
          onPick={() => onPick?.()}
          onChange={(v) => {
            onChange({ weekdayMinutes: Number(v) });
          }}
        />
      );
    case 'weekendMinutes':
      return (
        <RadioGroup
          legend={text.label}
          hideLegend={wizard}
          layout={wizard ? 'tiles' : 'chips'}
          options={timeOptions}
          value={String(draft.weekendMinutes)}
          onPick={() => onPick?.()}
          onChange={(v) => {
            onChange({ weekendMinutes: Number(v) });
          }}
        />
      );
    case 'weekdayLevel':
      return (
        <RadioGroup
          legend={text.label}
          hideLegend={wizard}
          layout="cards"
          options={levelOptions}
          value={draft.weekdayLevel}
          onPick={() => onPick?.()}
          onChange={(weekdayLevel) => {
            onChange({ weekdayLevel });
          }}
        />
      );
    case 'weekendLevel':
      return (
        <RadioGroup
          legend={text.label}
          hideLegend={wizard}
          layout="cards"
          options={levelOptions}
          value={draft.weekendLevel}
          onPick={() => onPick?.()}
          onChange={(weekendLevel) => {
            onChange({ weekendLevel });
          }}
        />
      );
    case 'breakfast':
      return yesNo(draft.breakfast, (breakfast) => {
        onChange({ breakfast });
      });
    case 'batchCooking':
      return yesNo(draft.batchCooking, (batchCooking) => {
        onChange({ batchCooking });
      });
  }
}

interface SectionListProps extends SectionProps {
  readonly step: 'moi' | 'objectif' | 'gouts' | 'organisation';
  readonly issues?: AboutIssues;
  readonly health?: HealthSummary | undefined;
}

/** Toutes les questions d'une partie, en liste (écrans d'édition du Profil). */
function SectionList({ step, draft, onChange, issues, health }: SectionListProps) {
  const ids = PROFILE_STEPS.find((s) => s.id === step)?.questions ?? [];
  return (
    <div className={styles.section}>
      {ids
        .filter((id) => id !== 'pregnancy' || (draft.sex !== undefined && draft.sex !== 'homme'))
        .map((id) => (
          <QuestionInput
            key={id}
            id={id}
            variant="list"
            draft={draft}
            onChange={onChange}
            {...(issues ? { issues } : {})}
            health={health}
          />
        ))}
    </div>
  );
}

interface AboutSectionProps extends SectionProps {
  readonly issues: AboutIssues;
}

export function AboutSection({ draft, onChange, issues }: AboutSectionProps) {
  return <SectionList step="moi" draft={draft} onChange={onChange} issues={issues} />;
}

interface GoalSectionProps extends SectionProps {
  readonly health: HealthSummary | undefined;
}

export function GoalSection({ draft, onChange, health }: GoalSectionProps) {
  return <SectionList step="objectif" draft={draft} onChange={onChange} health={health} />;
}

export function TastesSection({ draft, onChange }: SectionProps) {
  return <SectionList step="gouts" draft={draft} onChange={onChange} />;
}

export function OrganisationSection({ draft, onChange }: SectionProps) {
  return <SectionList step="organisation" draft={draft} onChange={onChange} />;
}
