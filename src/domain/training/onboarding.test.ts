import { describe, expect, it } from 'vitest';
import { makeProfile } from '../testing/fixtures';
import { makeTraining } from '../testing/training.fixtures';
import {
  TRAINING_ANSWERS,
  TRAINING_INPUT_MESSAGES,
  TRAINING_QUESTIONS,
  TRAINING_QUESTION_IDS,
  asksPregnancyStage,
  buildTrainingProfile,
  defaultTrainingInput,
  trainingInputOf,
  validateTrainingInput,
} from './onboarding';
import {
  DEFAULT_TRAINING_DAYS,
  EQUIPMENT_SETTINGS,
  SESSION_DURATIONS,
  TRAINING_FREQUENCIES,
  TRAINING_GOALS,
  TRAINING_LEVELS,
} from './training.constants';

describe('textes de l’onboarding Sport', () => {
  it('chaque question et chaque réponse a un texte au tutoiement, sans calories', () => {
    for (const id of TRAINING_QUESTION_IDS) {
      expect(TRAINING_QUESTIONS[id].prompt.length).toBeGreaterThan(5);
    }
    const answers = Object.values(TRAINING_ANSWERS).flatMap((group) => Object.values(group));
    expect(answers.length).toBe(
      TRAINING_FREQUENCIES.length +
        EQUIPMENT_SETTINGS.length +
        TRAINING_LEVELS.length +
        TRAINING_GOALS.length +
        SESSION_DURATIONS.length +
        3,
    );
    const all = [
      ...Object.values(TRAINING_QUESTIONS).flatMap((q) => [q.prompt, q.hint ?? '']),
      ...answers.flatMap((a) => [a.label, a.description ?? '']),
    ].join(' ');
    expect(all).not.toMatch(/kcal|calorie|brûler|compenser/i);
  });
});

describe('defaultTrainingInput', () => {
  it('propose 3 séances préremplies, à la maison, débutant, valides', () => {
    const input = defaultTrainingInput();
    expect(input.days).toEqual(DEFAULT_TRAINING_DAYS[3]);
    expect(input.level).toBe('debutant');
    expect(validateTrainingInput(input)).toEqual([]);
  });
});

describe('asksPregnancyStage', () => {
  it('seulement si grossesse ou allaitement déclaré, et pas pour un homme', () => {
    expect(asksPregnancyStage(makeProfile())).toBe(false);
    expect(asksPregnancyStage(makeProfile({ sex: 'femme', pregnantOrBreastfeeding: true }))).toBe(
      true,
    );
    expect(asksPregnancyStage(makeProfile({ sex: 'homme', pregnantOrBreastfeeding: true }))).toBe(
      false,
    );
  });
});

describe('validateTrainingInput', () => {
  const base = defaultTrainingInput();
  const fields = (input: object) =>
    validateTrainingInput({ ...base, ...input }).map((issue) => issue.field);

  it('refuse chaque valeur hors vocabulaire, avec un message', () => {
    expect(fields({ frequency: 7 })).toContain('frequency');
    expect(fields({ days: [0, 2] })).toEqual(['days']);
    expect(fields({ days: [0, 2, 2] })).toEqual(['days']);
    expect(fields({ days: [0, 2, 9] })).toEqual(['days']);
    expect(fields({ days: [0, 2, 1.5] })).toEqual(['days']);
    expect(fields({ setting: 'plage' })).toEqual(['setting']);
    expect(fields({ equipment: ['tapis', 'canon'] })).toEqual(['equipment']);
    expect(fields({ level: 'dieu' })).toEqual(['level']);
    expect(fields({ goal: 'gloire' })).toEqual(['goal']);
    expect(fields({ sessionMinutes: 25 })).toEqual(['sessionMinutes']);
    expect(fields({ pregnancyStage: 'bientot' })).toEqual(['pregnancyStage']);
    const [issue] = validateTrainingInput({ ...base, level: 'dieu' as never });
    expect(issue?.message).toBe(TRAINING_INPUT_MESSAGES.level);
  });

  it('accepte une étape de grossesse connue', () => {
    expect(fields({ pregnancyStage: 'post-partum' })).toEqual([]);
  });
});

describe('buildTrainingProfile', () => {
  const today = '2026-11-25';
  const answers = { ...defaultTrainingInput(), days: [4, 0, 2] as const };

  it('trie les jours, dédouble le matériel et place le début au lundi de la semaine', () => {
    const profile = buildTrainingProfile({
      answers: { ...answers, equipment: ['halteres', 'tapis', 'halteres'] },
      profile: makeProfile(),
      existing: undefined,
      today,
    });
    expect(profile.days).toEqual([0, 2, 4]);
    expect(profile.equipment).toEqual(['tapis', 'halteres']);
    expect(profile.startedOn).toBe('2026-11-23');
    expect(profile.safetyAcknowledgedOn).toBeUndefined();
  });

  it('garde le début et l’accusé de lecture d’une édition à l’autre', () => {
    const existing = makeTraining({ startedOn: '2026-10-05', safetyAcknowledgedOn: '2026-10-06' });
    const profile = buildTrainingProfile({
      answers: { ...answers, goal: 'force' },
      profile: makeProfile(),
      existing,
      today,
    });
    expect(profile.startedOn).toBe('2026-10-05');
    expect(profile.safetyAcknowledgedOn).toBe('2026-10-06');
    expect(profile.goal).toBe('force');
  });

  it('l’étape de grossesse n’a de sens que pour une grossesse déclarée ; en changer redemande la lecture', () => {
    const pregnant = makeProfile({ sex: 'femme', pregnantOrBreastfeeding: true });
    const existing = makeTraining({
      pregnancyStage: 'premier-trimestre',
      safetyAcknowledgedOn: '2026-10-06',
    });
    const same = buildTrainingProfile({
      answers: { ...answers, pregnancyStage: 'premier-trimestre' },
      profile: pregnant,
      existing,
      today,
    });
    expect(same.pregnancyStage).toBe('premier-trimestre');
    expect(same.safetyAcknowledgedOn).toBe('2026-10-06');
    const changed = buildTrainingProfile({
      answers: { ...answers, pregnancyStage: 'post-partum' },
      profile: pregnant,
      existing,
      today,
    });
    expect(changed.safetyAcknowledgedOn).toBeUndefined();
    const notPregnant = buildTrainingProfile({
      answers: { ...answers, pregnancyStage: 'post-partum' },
      profile: makeProfile(),
      existing: undefined,
      today,
    });
    expect(notPregnant.pregnancyStage).toBeUndefined();
  });

  it('trainingInputOf rend les réponses modifiables, étape comprise', () => {
    const training = makeTraining({ pregnancyStage: 'post-partum' });
    const input = trainingInputOf(training);
    expect(input.pregnancyStage).toBe('post-partum');
    expect('startedOn' in input).toBe(false);
    expect(trainingInputOf(makeTraining()).pregnancyStage).toBeUndefined();
  });
});
