import { describe, expect, it } from 'vitest';
import { addDays } from '../shared';
import {
  PAIN_RULES,
  TRAINING_SAFETY_MESSAGES,
  avoidedExerciseIds,
  painAvoidanceEnd,
  painMessages,
  type MuscleGroup,
  type PainReport,
} from '.';

const TODAY = '2026-11-25';
const report = (
  daysAgo: number,
  exerciseId: string,
  muscles: MuscleGroup[] = ['pectoraux'],
): PainReport => {
  const date = addDays(TODAY, -daysAgo);
  return { id: `${date}:${exerciseId}`, date, exerciseId, muscles };
};

describe('avoidedExerciseIds : 28 jours', () => {
  it('écarte l’exercice le jour du signalement et les 27 jours suivants', () => {
    expect(avoidedExerciseIds([report(0, 'a')], TODAY)).toEqual(['a']);
    expect(avoidedExerciseIds([report(27, 'a')], TODAY)).toEqual(['a']);
  });

  it('le propose de nouveau le 28e jour', () => {
    expect(avoidedExerciseIds([report(PAIN_RULES.avoidDays, 'a')], TODAY)).toEqual([]);
    expect(avoidedExerciseIds([report(60, 'a')], TODAY)).toEqual([]);
  });

  it('garde par prudence un signalement daté d’après aujourd’hui', () => {
    expect(avoidedExerciseIds([report(-3, 'a')], TODAY)).toEqual(['a']);
  });

  it('trie et dédoublonne', () => {
    const ids = avoidedExerciseIds([report(1, 'b'), report(5, 'a'), report(9, 'b')], TODAY);
    expect(ids).toEqual(['a', 'b']);
    expect(avoidedExerciseIds([], TODAY)).toEqual([]);
  });

  it('donne le premier jour de retour', () => {
    expect(painAvoidanceEnd('2026-11-25')).toBe('2026-12-23');
    expect(avoidedExerciseIds([report(0, 'a')], painAvoidanceEnd(TODAY))).toEqual([]);
  });
});

describe('painMessages', () => {
  const base = [TRAINING_SAFETY_MESSAGES.douleur, TRAINING_SAFETY_MESSAGES.urgence];

  it('rend toujours « douleur » puis « urgence »', () => {
    expect(painMessages([], TODAY)).toEqual(base);
    expect(painMessages([report(0, 'a')], TODAY)).toEqual(base);
  });

  it('ajoute « douleur répétée » pour deux signalements d’un même groupe en 14 jours', () => {
    const messages = painMessages([report(0, 'a'), report(10, 'b')], TODAY);
    expect(messages.map((m) => m.code)).toEqual(['douleur', 'douleur-repetee', 'urgence']);
  });

  it('respecte la fenêtre : 13 jours compte, 14 jours non', () => {
    expect(painMessages([report(0, 'a'), report(13, 'b')], TODAY)).toHaveLength(3);
    expect(painMessages([report(0, 'a'), report(PAIN_RULES.windowDays, 'b')], TODAY)).toHaveLength(
      2,
    );
  });

  it('exige un groupe commun', () => {
    const messages = painMessages([report(0, 'a', ['pectoraux']), report(2, 'b', ['dos'])], TODAY);
    expect(messages).toHaveLength(2);
    expect(
      painMessages([report(0, 'a', ['dos', 'biceps']), report(2, 'b', ['biceps'])], TODAY),
    ).toHaveLength(3);
  });

  it('ne parle pas de calories ni de culpabilité', () => {
    for (const m of painMessages([report(0, 'a'), report(1, 'b')], TODAY)) {
      expect(m.text).not.toMatch(/calorie|kcal|faute|honte/i);
      expect(m.suggestProfessional).toBe(true);
    }
  });
});
