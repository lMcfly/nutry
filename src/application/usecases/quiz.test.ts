import { describe, expect, it } from 'vitest';
import { createInMemoryPorts } from '../testing';
import { createUseCases } from '.';
import type { QuizQuestion } from '@domain/quiz';

const question = (id: string, category: QuizQuestion['category'] = 'histoire'): QuizQuestion => ({
  id,
  question: `Question ${id} ?`,
  choices: ['A', 'B', 'C', 'D'],
  correctIndex: 1,
  explanation: `Parce que ${id}.`,
  category,
  difficulty: 'facile',
});

const QUESTIONS = [question('q1'), question('q2'), question('q3', 'cuisine'), question('q4')];

const setup = (questions = QUESTIONS) => {
  const ports = createInMemoryPorts({ questions });
  return { ports, uc: createUseCases(ports) };
};

describe('quiz du jour', () => {
  it('rien sans question', async () => {
    await expect(setup([]).uc.getDailyQuiz()).resolves.toBeUndefined();
  });

  it('pose la même question toute la journée, sans révéler la réponse', async () => {
    const { uc } = setup();
    const first = await uc.getDailyQuiz();
    expect(first).toBeDefined();
    expect(first).not.toHaveProperty('correctIndex');
    expect(first?.answer).toBeUndefined();
    const again = await uc.getDailyQuiz();
    expect(again?.questionId).toBe(first?.questionId);
  });

  it('répond, compte la série, et ne compte pas deux fois', async () => {
    const { uc, ports } = setup();
    const daily = await uc.getDailyQuiz();
    const questionId = daily?.questionId ?? '';
    const answer = await uc.answerQuiz({ questionId, answerIndex: 1 });
    expect(answer).toMatchObject({ correct: true, correctIndex: 1, streak: 1, bestStreak: 1 });
    expect(answer?.explanation).toMatch(/^Parce que/);

    const replay = await uc.answerQuiz({ questionId, answerIndex: 0 });
    expect(replay).toMatchObject({ correct: true, answerIndex: 1, streak: 1 });
    const reopened = await uc.getDailyQuiz();
    expect(reopened?.answer).toMatchObject({ correct: true, answerIndex: 1 });

    ports.clock.set('2026-11-24T08:00:00.000Z');
    const tomorrow = await uc.getDailyQuiz();
    expect(tomorrow?.questionId).not.toBe(questionId);
    const wrong = await uc.answerQuiz({ questionId: tomorrow?.questionId ?? '', answerIndex: 3 });
    expect(wrong).toMatchObject({ correct: false, streak: 0, bestStreak: 1 });
  });

  it('refuse une réponse à une autre question que celle du jour', async () => {
    const { uc, ports } = setup();
    await expect(uc.answerQuiz({ questionId: 'q1', answerIndex: 1 })).resolves.toBeUndefined();
    const daily = await uc.getDailyQuiz();
    const other = QUESTIONS.find((q) => q.id !== daily?.questionId)?.id ?? '';
    await expect(uc.answerQuiz({ questionId: other, answerIndex: 1 })).resolves.toBeUndefined();
    // Question retirée de la banque après une mise à jour.
    ports.quizBank.questions = [];
    await expect(
      uc.answerQuiz({ questionId: daily?.questionId ?? '', answerIndex: 1 }),
    ).resolves.toBeUndefined();
  });
});
