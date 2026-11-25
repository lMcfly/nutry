import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRestTimer } from './useRestTimer';

describe('useRestTimer', () => {
  let now = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    now = 1_000;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const advance = (ms: number) => {
    now += ms;
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  it('décompte depuis l’instant de fin, +15 s, et annonce la fin', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => useRestTimer({ onEnd, now: () => now }));
    act(() => {
      result.current.start(60);
    });
    expect(result.current.running).toBe(true);
    expect(result.current.total).toBe(60);
    advance(20_000);
    expect(result.current.remaining).toBeCloseTo(40, 0);
    act(() => {
      result.current.add(15);
    });
    expect(result.current.total).toBe(75);
    advance(50_000);
    expect(result.current.remaining).toBeCloseTo(5, 0);
    expect(onEnd).not.toHaveBeenCalled();
    advance(6_000);
    expect(result.current.running).toBe(false);
    expect(onEnd).toHaveBeenCalledWith('done');
  });

  it('juste après une mise en veille : le temps écoulé est rattrapé d’un coup', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => useRestTimer({ onEnd, now: () => now }));
    act(() => {
      result.current.start(90);
    });
    // L'appareil dort 2 minutes : aucun intervalle ne tourne, l'horloge, elle, avance.
    now += 120_000;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.running).toBe(false);
    expect(onEnd).toHaveBeenCalledWith('done');
  });

  it('« Passer » arrête tout de suite ; « stop » ne dit rien', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => useRestTimer({ onEnd, now: () => now }));
    act(() => {
      result.current.start(30);
    });
    act(() => {
      result.current.skip();
    });
    expect(result.current.running).toBe(false);
    expect(onEnd).toHaveBeenCalledWith('skipped');
    act(() => {
      result.current.start(30);
    });
    act(() => {
      result.current.stop();
    });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(result.current.remaining).toBe(0);
  });
});
