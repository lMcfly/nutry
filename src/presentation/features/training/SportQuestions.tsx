import { useState } from 'react';
import {
  DEFAULT_TRAINING_DAYS,
  EQUIPMENT,
  EQUIPMENT_BY_SETTING,
  EQUIPMENT_SETTINGS,
  PREGNANCY_STAGES,
  SESSION_DURATIONS,
  TRAINING_ANSWERS,
  TRAINING_FREQUENCIES,
  TRAINING_GOALS,
  TRAINING_LEVELS,
  TRAINING_QUESTIONS,
} from '@domain/training';
import type {
  Equipment,
  EquipmentSetting,
  PregnancyStage,
  SessionDuration,
  TrainingFrequency,
  TrainingGoal,
  TrainingLevel,
  TrainingProfileInput,
} from '@domain/training';
import { DAY_INDEXES } from '@domain/mealplan';
import type { DayIndex } from '@domain/mealplan';
import { ChipGroup, RadioGroup } from '../../components/Choice';
import { ChevronDownIcon } from '../../components/icons';
import {
  DAY_LABELS,
  EQUIPMENT_EMOJIS,
  EQUIPMENT_LABELS,
  EQUIPMENT_SETTING_EMOJIS,
  PREGNANCY_STAGE_EMOJIS,
  SESSION_DURATION_EMOJIS,
  TRAINING_FREQUENCY_EMOJIS,
  TRAINING_GOAL_EMOJIS,
  TRAINING_LEVEL_EMOJIS,
} from '../../i18n/labels';
import type { SportQuestionId } from './sportQuestionIds';
import styles from './SportQuestions.module.css';

interface SportQuestionProps {
  readonly id: SportQuestionId;
  /** `wizard` : une question par écran (onboarding) ; `list` : feuille de réglages. */
  readonly variant: 'wizard' | 'list';
  readonly draft: TrainingProfileInput;
  readonly onChange: (patch: Partial<TrainingProfileInput>) => void;
  /** Choix au doigt (passage automatique à la question suivante). */
  readonly onPick?: () => void;
}

/** Une question du profil sportif ; textes et réponses du domain (ADR 0010). */
export function SportQuestion({ id, variant, draft, onChange, onPick }: SportQuestionProps) {
  const wizard = variant === 'wizard';
  const q = TRAINING_QUESTIONS[id];
  const legend = q.label;
  const [adjusting, setAdjusting] = useState(false);

  switch (id) {
    case 'frequency':
      return (
        <div className={styles.frequency}>
          <RadioGroup
            legend={legend}
            hideLegend={wizard}
            layout="tiles"
            options={TRAINING_FREQUENCIES.map((f) => ({
              value: String(f),
              label: TRAINING_ANSWERS.frequency[f].label,
              emoji: TRAINING_FREQUENCY_EMOJIS[f],
              ...(TRAINING_ANSWERS.frequency[f].description !== undefined
                ? { hint: TRAINING_ANSWERS.frequency[f].description }
                : {}),
            }))}
            value={String(draft.frequency)}
            onChange={(value) => {
              const frequency = Number(value) as TrainingFrequency;
              onChange({ frequency, days: DEFAULT_TRAINING_DAYS[frequency] });
            }}
            onPick={onPick}
          />
        </div>
      );
    case 'days':
      return (
        <div className={styles.days}>
          <ChipGroup
            legend={legend}
            hideLegend={wizard}
            hint={
              wizard
                ? undefined
                : `${draft.days.length} sur ${draft.frequency} : autant de jours que de séances.`
            }
            options={DAY_INDEXES.map((d) => ({ value: String(d), label: DAY_LABELS[d] }))}
            selected={draft.days.map(String)}
            onChange={(selected) => {
              onChange({
                days: selected.map((d) => Number(d) as DayIndex).sort((a, b) => a - b),
              });
            }}
          />
          {wizard && (
            <p className={styles.counter} aria-live="polite">
              {draft.days.length} sur {draft.frequency}
            </p>
          )}
        </div>
      );
    case 'setting':
      return (
        <div className={styles.setting}>
          <RadioGroup
            legend={legend}
            hideLegend={wizard}
            layout="cards"
            options={EQUIPMENT_SETTINGS.map((s) => ({
              value: s,
              label: TRAINING_ANSWERS.setting[s].label,
              emoji: EQUIPMENT_SETTING_EMOJIS[s],
              ...(TRAINING_ANSWERS.setting[s].description !== undefined
                ? { hint: TRAINING_ANSWERS.setting[s].description }
                : {}),
            }))}
            value={draft.setting}
            onChange={(setting: EquipmentSetting) => {
              onChange({ setting, equipment: EQUIPMENT_BY_SETTING[setting] });
            }}
          />
          {wizard && (
            <button
              type="button"
              className={styles.disclosure}
              aria-expanded={adjusting}
              onClick={() => {
                setAdjusting((a) => !a);
              }}
            >
              Ajuster mon matériel
              <ChevronDownIcon size={18} className={adjusting ? styles.open : undefined} />
            </button>
          )}
          {(!wizard || adjusting) && (
            <ChipGroup
              legend="Mon matériel"
              options={EQUIPMENT.map((e) => ({
                value: e,
                label: EQUIPMENT_LABELS[e],
                emoji: EQUIPMENT_EMOJIS[e],
              }))}
              selected={draft.equipment}
              onChange={(equipment: Equipment[]) => {
                onChange({ equipment });
              }}
            />
          )}
        </div>
      );
    case 'level':
      return (
        <RadioGroup
          legend={legend}
          hideLegend={wizard}
          layout="cards"
          options={TRAINING_LEVELS.map((l) => ({
            value: l,
            label: TRAINING_ANSWERS.level[l].label,
            emoji: TRAINING_LEVEL_EMOJIS[l],
            ...(TRAINING_ANSWERS.level[l].description !== undefined
              ? { hint: TRAINING_ANSWERS.level[l].description }
              : {}),
          }))}
          value={draft.level}
          onChange={(level: TrainingLevel) => {
            onChange({ level });
          }}
          onPick={onPick}
        />
      );
    case 'goal':
      return (
        <RadioGroup
          legend={legend}
          hideLegend={wizard}
          layout="cards"
          options={TRAINING_GOALS.map((g) => ({
            value: g,
            label: TRAINING_ANSWERS.goal[g].label,
            emoji: TRAINING_GOAL_EMOJIS[g],
            ...(TRAINING_ANSWERS.goal[g].description !== undefined
              ? { hint: TRAINING_ANSWERS.goal[g].description }
              : {}),
          }))}
          value={draft.goal}
          onChange={(goal: TrainingGoal) => {
            onChange({ goal });
          }}
          onPick={onPick}
        />
      );
    case 'duration':
      return (
        <div className={styles.duration}>
          <RadioGroup
            legend={legend}
            hideLegend={wizard}
            layout="tiles"
            options={SESSION_DURATIONS.map((d) => ({
              value: String(d),
              label: TRAINING_ANSWERS.duration[d].label,
              emoji: SESSION_DURATION_EMOJIS[d],
              ...(TRAINING_ANSWERS.duration[d].description !== undefined
                ? { hint: TRAINING_ANSWERS.duration[d].description }
                : {}),
            }))}
            value={String(draft.sessionMinutes)}
            onChange={(value) => {
              onChange({ sessionMinutes: Number(value) as SessionDuration });
            }}
          />
        </div>
      );
    case 'pregnancyStage':
      return (
        <RadioGroup
          legend={legend}
          hideLegend={wizard}
          hint={wizard ? undefined : q.hint}
          layout="cards"
          options={PREGNANCY_STAGES.map((p) => ({
            value: p,
            label: TRAINING_ANSWERS.pregnancyStage[p].label,
            emoji: PREGNANCY_STAGE_EMOJIS[p],
          }))}
          value={draft.pregnancyStage}
          onChange={(pregnancyStage: PregnancyStage) => {
            onChange({ pregnancyStage });
          }}
        />
      );
  }
}
