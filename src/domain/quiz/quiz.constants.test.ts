import { describe, expect, it } from 'vitest';
import { QUIZ_CATEGORIES, QUIZ_CHOICES_COUNT, QUIZ_DIFFICULTIES } from './quiz.constants';

describe('constantes du quiz', () => {
  it('inclut la catégorie cuisine parmi des catégories uniques', () => {
    expect(QUIZ_CATEGORIES).toContain('cuisine');
    expect(new Set(QUIZ_CATEGORIES).size).toBe(QUIZ_CATEGORIES.length);
  });

  it('définit 3 difficultés et 4 choix par question', () => {
    expect(QUIZ_DIFFICULTIES).toHaveLength(3);
    expect(QUIZ_CHOICES_COUNT).toBe(4);
  });
});
