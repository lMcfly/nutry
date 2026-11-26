import { describe, expect, it } from 'vitest';
import { ACTIVITY_LEVELS } from '../profile';
import type { ActivityLevel } from '../profile';
import {
  ACTIVITY_FLOOR_BY_WEEKLY_MINUTES,
  SESSION_DURATIONS,
  TRAINING_FREQUENCIES,
  suggestActivityLevel,
  weeklyTrainingMinutes,
} from '.';

type Volume = Parameters<typeof suggestActivityLevel>[1];
const volume = (frequency: number, sessionMinutes: number): Volume =>
  ({ frequency, sessionMinutes }) as Volume;

describe('suggestActivityLevel : un cran au plus, jamais automatique', () => {
  it('volume = fréquence × durée', () => {
    expect(weeklyTrainingMinutes(volume(3, 45))).toBe(135);
  });

  it('rien à proposer quand le volume ne dépasse pas le niveau déclaré', () => {
    // 2 × 20 = 40 min : sous le premier palier (60).
    expect(suggestActivityLevel('sedentaire', volume(2, 20))).toBeUndefined();
    // 3 × 45 = 135 min : palier « léger » ; « modéré » déclaré le dépasse déjà.
    expect(suggestActivityLevel('modere', volume(3, 45))).toBeUndefined();
    expect(suggestActivityLevel('tres-actif', volume(5, 60))).toBeUndefined();
  });

  it('propose le niveau suivant quand le palier du volume est plus haut que le niveau déclaré', () => {
    // 3 × 30 = 90 min : plancher « léger ».
    expect(suggestActivityLevel('sedentaire', volume(3, 30))).toBe('leger');
    // 4 × 45 = 180 min : plancher « modéré », déclaré « léger ».
    expect(suggestActivityLevel('leger', volume(4, 45))).toBe('modere');
  });

  it('un cran au plus, même si le volume en justifierait davantage', () => {
    // 5 × 60 = 300 min : plancher « actif » ; sédentaire → léger seulement.
    expect(suggestActivityLevel('sedentaire', volume(5, 60))).toBe('leger');
    expect(suggestActivityLevel('leger', volume(5, 60))).toBe('modere');
  });

  it('propriété : jamais plus d’un cran, jamais une baisse, toujours au plus le plancher', () => {
    for (const frequency of TRAINING_FREQUENCIES) {
      for (const sessionMinutes of SESSION_DURATIONS) {
        for (const declared of ACTIVITY_LEVELS) {
          const training = volume(frequency, sessionMinutes);
          const suggested = suggestActivityLevel(declared, training);
          if (suggested === undefined) continue;
          const gap = ACTIVITY_LEVELS.indexOf(suggested) - ACTIVITY_LEVELS.indexOf(declared);
          expect(gap).toBe(1);
          const floor = ACTIVITY_FLOOR_BY_WEEKLY_MINUTES.filter(
            (s) => weeklyTrainingMinutes(training) >= s.fromMinutes,
          ).at(-1)?.activity as ActivityLevel;
          expect(ACTIVITY_LEVELS.indexOf(suggested)).toBeLessThanOrEqual(
            ACTIVITY_LEVELS.indexOf(floor),
          );
        }
      }
    }
  });
});
