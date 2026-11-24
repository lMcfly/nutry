import { describe, expect, it } from 'vitest';
import {
  PROFILE_QUESTIONS,
  PROFILE_QUESTION_IDS,
  PROFILE_STEPS,
  onboardingQuestions,
  stepOfQuestion,
} from './questions';

describe('questions du profil', () => {
  it('chaque question a un texte et appartient à exactement une partie', () => {
    for (const id of PROFILE_QUESTION_IDS) {
      expect(PROFILE_QUESTIONS[id].prompt.length).toBeGreaterThan(5);
      expect(PROFILE_QUESTIONS[id].label.length).toBeGreaterThan(2);
      expect(PROFILE_STEPS.filter((s) => s.questions.includes(id))).toHaveLength(1);
      expect(stepOfQuestion(id).questions).toContain(id);
    }
  });

  it('les questions obligatoires sont celles dont le domain a besoin', () => {
    const required = PROFILE_QUESTION_IDS.filter((id) => !PROFILE_QUESTIONS[id].optional);
    expect(required).toEqual(
      expect.arrayContaining(['age', 'sex', 'height', 'weight', 'pregnancy', 'goal', 'dietBase']),
    );
    expect(PROFILE_QUESTIONS.healthCondition.optional).toBe(true);
  });

  it('garde-fou : la grossesse n’est demandée qu’à une personne qui n’est pas un homme', () => {
    expect(onboardingQuestions(undefined)).not.toContain('pregnancy');
    expect(onboardingQuestions('homme')).not.toContain('pregnancy');
    for (const sex of ['femme', 'autre'] as const) {
      const ids = onboardingQuestions(sex);
      expect(ids).toContain('pregnancy');
      expect(ids.indexOf('pregnancy')).toBe(ids.indexOf('sex') + 1);
    }
    expect(onboardingQuestions('homme')).toHaveLength(PROFILE_QUESTION_IDS.length - 1);
  });

  it('l’âge ouvre le parcours et la santé arrive avant l’objectif', () => {
    const ids = onboardingQuestions('femme');
    expect(ids[0]).toBe('age');
    expect(ids.indexOf('healthCondition')).toBeLessThan(ids.indexOf('goal'));
  });

  it('ton bienveillant : aucune injonction culpabilisante', () => {
    for (const id of PROFILE_QUESTION_IDS) {
      const text = Object.values(PROFILE_QUESTIONS[id]).join(' ');
      expect(text).not.toMatch(/\b(vous devez|il faut absolument|régime strict|calorie)/i);
    }
  });
});
