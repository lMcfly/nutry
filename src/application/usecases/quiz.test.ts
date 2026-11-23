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

/** Nouvelle ouverture de l'app : la portée `session` du stockage d'appareil repart à vide. */
const reopenApp = (ports: ReturnType<typeof setup>['ports']) => {
  ports.device.values.session.clear();
};

describe('quiz : une question à chaque ouverture', () => {
  it('rien sans question', async () => {
    await expect(setup([]).uc.getQuiz()).resolves.toBeUndefined();
  });

  it('même question pendant toute la session (rechargements compris), sans révéler la réponse', async () => {
    const { uc, ports } = setup();
    const first = await uc.getQuiz();
    expect(first).toBeDefined();
    expect(first).not.toHaveProperty('correctIndex');
    expect(first?.answer).toBeUndefined();
    expect(await uc.getQuiz()).toEqual(first);
    // Rechargement de la page : nouveaux cas d'usage, même stockage de session.
    const reloaded = createUseCases(ports);
    expect((await reloaded.getQuiz())?.questionId).toBe(first?.questionId);
    // Le changement de jour ne change rien dans la même session.
    ports.clock.set('2026-11-24T08:00:00.000Z');
    expect((await uc.getQuiz())?.questionId).toBe(first?.questionId);
  });

  it('nouvelle ouverture → nouvelle question, même le même jour', async () => {
    const { uc, ports } = setup();
    const seen = new Set<string>();
    for (let n = 0; n < QUESTIONS.length; n += 1) {
      const quiz = await uc.getQuiz();
      seen.add(quiz?.questionId ?? '');
      await uc.answerQuiz({ questionId: quiz?.questionId ?? '', answerIndex: 1 });
      reopenApp(ports);
    }
    // Toute la banque, sans répétition avant épuisement.
    expect(seen.size).toBe(QUESTIONS.length);
  });

  it('répond, compte la série, et ne compte pas deux fois', async () => {
    const { uc, ports } = setup();
    const quiz = await uc.getQuiz();
    const questionId = quiz?.questionId ?? '';
    const answer = await uc.answerQuiz({ questionId, answerIndex: 1 });
    expect(answer).toMatchObject({ correct: true, correctIndex: 1, streak: 1, bestStreak: 1 });
    expect(answer?.explanation).toMatch(/^Parce que/);
    expect(ports.state.quiz.seenIds).toEqual([questionId]);

    const replay = await uc.answerQuiz({ questionId, answerIndex: 0 });
    expect(replay).toMatchObject({ correct: true, answerIndex: 1, streak: 1 });
    const reopened = await uc.getQuiz();
    expect(reopened?.answer).toMatchObject({ correct: true, answerIndex: 1 });

    reopenApp(ports);
    const next = await uc.getQuiz();
    expect(next?.questionId).not.toBe(questionId);
    expect(next?.answer).toBeUndefined();
    const wrong = await uc.answerQuiz({ questionId: next?.questionId ?? '', answerIndex: 3 });
    expect(wrong).toMatchObject({ correct: false, streak: 0, bestStreak: 1 });
  });

  it('une question fermée sans réponse ne casse pas la série et reste « non vue »', async () => {
    const { uc, ports } = setup();
    const first = await uc.getQuiz();
    await uc.answerQuiz({ questionId: first?.questionId ?? '', answerIndex: 1 });
    reopenApp(ports);
    const skipped = await uc.getQuiz();
    expect(skipped?.streak).toBe(1);
    // Fermée sans réponse : nouvelle ouverture.
    reopenApp(ports);
    const third = await uc.getQuiz();
    expect(third?.questionId).not.toBe(skipped?.questionId);
    expect(ports.state.quiz.seenIds).not.toContain(skipped?.questionId);
    const answer = await uc.answerQuiz({ questionId: third?.questionId ?? '', answerIndex: 1 });
    expect(answer).toMatchObject({ streak: 2, bestStreak: 2 });
  });

  it('refuse une réponse à une autre question que celle de la session', async () => {
    const { uc, ports } = setup();
    await expect(uc.answerQuiz({ questionId: 'q1', answerIndex: 1 })).resolves.toBeUndefined();
    const quiz = await uc.getQuiz();
    const other = QUESTIONS.find((q) => q.id !== quiz?.questionId)?.id ?? '';
    await expect(uc.answerQuiz({ questionId: other, answerIndex: 1 })).resolves.toBeUndefined();
    // Question d'une session précédente : refusée après une nouvelle ouverture.
    reopenApp(ports);
    await expect(
      uc.answerQuiz({ questionId: quiz?.questionId ?? '', answerIndex: 1 }),
    ).resolves.toBeUndefined();
    const current = await uc.getQuiz();
    // Question retirée de la banque après une mise à jour.
    ports.quizBank.questions = [];
    await expect(
      uc.answerQuiz({ questionId: current?.questionId ?? '', answerIndex: 1 }),
    ).resolves.toBeUndefined();
  });

  it('l’identifiant de session est gardé dans la portée `session` de l’appareil', async () => {
    const { uc, ports } = setup();
    await uc.getQuiz();
    const id = ports.device.get('session', 'quiz.session-id');
    expect(id).toMatch(/^s-[0-9a-z]{20}$/);
    expect(ports.state.quiz.current?.sessionId).toBe(id);
    expect(ports.device.values.local.size).toBe(0);
  });
});
