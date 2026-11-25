/** Profils et entrées de test du module Sport (jamais importés par le code de prod). */
import type { Profile } from '../profile';
import {
  DEFAULT_TRAINING_DAYS,
  EQUIPMENT_BY_SETTING,
  type EquipmentSetting,
  type TrainingFrequency,
} from '../training/training.constants';
import type { PlanTrainingWeekInput } from '../training/training.contracts';
import type { TrainingProfile } from '../training/training.types';
import { EXERCISE_FIXTURES } from './exercises.fixtures';
import { makeProfile } from './fixtures';

/** Lundi de la semaine de référence des tests. */
export const WEEK = '2026-11-23';
/** Un mercredi de cette semaine. */
export const TODAY = '2026-11-25';

export function makeTraining(overrides: Partial<TrainingProfile> = {}): TrainingProfile {
  const setting: EquipmentSetting = overrides.setting ?? 'maison-equipee';
  const frequency: TrainingFrequency = overrides.frequency ?? 3;
  return {
    frequency,
    days: DEFAULT_TRAINING_DAYS[frequency],
    setting,
    equipment: EQUIPMENT_BY_SETTING[setting],
    level: 'intermediaire',
    goal: 'muscle',
    sessionMinutes: 45,
    startedOn: WEEK,
    ...overrides,
  };
}

export function makePlanInput(
  training: Partial<TrainingProfile> = {},
  profile: Partial<Profile> = {},
  extra: Partial<PlanTrainingWeekInput> = {},
): PlanTrainingWeekInput {
  return {
    weekStart: WEEK,
    profile: makeProfile(profile),
    training: makeTraining(training),
    catalog: EXERCISE_FIXTURES,
    logs: [],
    painReports: [],
    today: TODAY,
    ...extra,
  };
}
