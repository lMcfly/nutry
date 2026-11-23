import { describe, expect, it } from 'vitest';
import {
  ACCESSORY_IDS,
  COLOR_IDS,
  COMPANION_ACCESSORIES,
  COMPANION_CATALOG,
  COMPANION_COLORS,
  COMPANION_EYES,
  COMPANION_MESSAGES,
  DEFAULT_LOOK,
  EYE_IDS,
  INITIAL_COMPANION_STATE,
  acknowledge,
  companionMessage,
  currentStreak,
  equip,
  moodOf,
  newlyUnlockedItems,
  nextUnlock,
  recordActivity,
  unlockedItems,
} from '.';
import type { CompanionLook, CompanionState } from '.';

/** Enregistre un geste à chacun des jours donnés. */
const play = (...days: string[]): CompanionState =>
  days.reduce(recordActivity, INITIAL_COMPANION_STATE);

/** Série de `n` jours consécutifs à partir de `from`. */
function run(n: number, from = '2026-01-01'): CompanionState {
  let state = INITIAL_COMPANION_STATE;
  const start = new Date(`${from}T00:00:00Z`).getTime();
  for (let i = 0; i < n; i++) {
    state = recordActivity(state, new Date(start + i * 86_400_000).toISOString().slice(0, 10));
  }
  return state;
}

const ids = (items: readonly { id: string }[]) => items.map((i) => i.id);

describe('catalogue', () => {
  it('ses identifiants correspondent aux vocabulaires fermés', () => {
    expect(ids(COMPANION_COLORS)).toEqual([...COLOR_IDS]);
    expect(ids(COMPANION_EYES)).toEqual([...EYE_IDS]);
    expect([...ids(COMPANION_ACCESSORIES)].sort()).toEqual([...ACCESSORY_IDS].sort());
    expect(new Set(ids(COMPANION_CATALOG.filter((i) => i.kind === 'accessory'))).size).toBe(7);
  });

  it('6 teintes de base, 3 spéciales, 5 yeux ; libellés et emoji renseignés', () => {
    expect(COMPANION_COLORS.filter((c) => c.unlockAt === 0)).toHaveLength(6);
    expect(COMPANION_COLORS.filter((c) => c.unlockAt > 0).map((c) => c.unlockAt)).toEqual([
      5, 15, 45,
    ]);
    expect(COMPANION_EYES).toHaveLength(5);
    expect(COMPANION_EYES.every((e) => e.unlockAt === 0)).toBe(true);
    expect(COMPANION_CATALOG.every((i) => i.label.length > 0 && i.emoji.length > 0)).toBe(true);
  });

  it('seuils des accessoires', () => {
    expect(COMPANION_ACCESSORIES.map((a) => [a.id, a.unlockAt])).toEqual([
      ['feuille', 1],
      ['lunettes-rondes', 3],
      ['toque-de-chef', 7],
      ['echarpe', 10],
      ['tablier', 14],
      ['bonnet', 21],
      ['couronne-de-fruits', 30],
    ]);
  });
});

describe('recordActivity', () => {
  it('premier geste : série 1, record 1', () => {
    expect(play('2026-03-10')).toMatchObject({ lastActiveDay: '2026-03-10', streak: 1, best: 1 });
  });

  it('même jour deux fois : état inchangé (même référence)', () => {
    const once = play('2026-03-10');
    expect(recordActivity(once, '2026-03-10')).toBe(once);
  });

  it('jours consécutifs : la série monte', () => {
    expect(play('2026-03-10', '2026-03-11', '2026-03-12')).toMatchObject({ streak: 3, best: 3 });
  });

  it('jour manqué : repart à 1, record conservé', () => {
    const state = play('2026-03-10', '2026-03-11', '2026-03-12', '2026-03-14');
    expect(state).toMatchObject({ streak: 1, best: 3, lastActiveDay: '2026-03-14' });
  });

  it('une série plus courte ne baisse pas le record, une plus longue le dépasse', () => {
    const state = play('2026-03-01', '2026-03-02', '2026-03-10', '2026-03-11', '2026-03-12');
    expect(state).toMatchObject({ streak: 3, best: 3 });
  });

  it('change de mois et d’année sans casser la série', () => {
    expect(play('2026-01-31', '2026-02-01').streak).toBe(2);
    expect(play('2026-12-31', '2027-01-01').streak).toBe(2);
    expect(play('2028-02-28', '2028-02-29', '2028-03-01').streak).toBe(3);
    expect(play('2027-02-28', '2027-03-01').streak).toBe(2);
  });

  it('ignore un jour antérieur au dernier jour actif (horloge reculée)', () => {
    const state = play('2026-03-10', '2026-03-11');
    expect(recordActivity(state, '2026-03-05')).toBe(state);
  });
});

describe('currentStreak et moodOf', () => {
  const state = play('2026-03-10', '2026-03-11', '2026-03-12');

  it('actif aujourd’hui : série et humeur joyeuse', () => {
    expect(currentStreak(state, '2026-03-12')).toBe(3);
    expect(moodOf(state, '2026-03-12')).toBe('joyeux');
  });

  it('actif hier : la série tient encore, humeur contente', () => {
    expect(currentStreak(state, '2026-03-13')).toBe(3);
    expect(moodOf(state, '2026-03-13')).toBe('content');
  });

  it('un jour entier manqué : série à 0, sieste', () => {
    expect(currentStreak(state, '2026-03-14')).toBe(0);
    expect(moodOf(state, '2026-03-14')).toBe('sieste');
    expect(moodOf(state, '2027-01-01')).toBe('sieste');
  });

  it('avant tout geste : série 0 et accueil (pas de sieste)', () => {
    expect(currentStreak(INITIAL_COMPANION_STATE, '2026-03-14')).toBe(0);
    expect(moodOf(INITIAL_COMPANION_STATE, '2026-03-14')).toBe('content');
  });

  it('messages adaptés, jamais culpabilisants', () => {
    expect(companionMessage(INITIAL_COMPANION_STATE, '2026-03-14')).toBe(
      COMPANION_MESSAGES.welcome,
    );
    expect(companionMessage(play('2026-03-10'), '2026-03-10')).toBe(COMPANION_MESSAGES.joyeuxFirst);
    expect(companionMessage(state, '2026-03-12')).toContain('3 jours');
    expect(companionMessage(state, '2026-03-13')).toBe(COMPANION_MESSAGES.content);
    expect(companionMessage(state, '2026-03-20')).toContain('record de 3 jours');
    expect(companionMessage(play('2026-03-10'), '2026-03-20')).toBe(COMPANION_MESSAGES.sieste(1));
  });
});

describe('unlockedItems', () => {
  const unlockedAt = (best: number) => ids(unlockedItems(run(best))).join(',');

  it('avant tout geste : teintes et yeux de base seulement', () => {
    const base = unlockedItems(INITIAL_COMPANION_STATE);
    expect(base).toHaveLength(11);
    expect(base.some((i) => i.kind === 'accessory')).toBe(false);
  });

  it.each([
    [1, 'feuille'],
    [3, 'lunettes-rondes'],
    [5, 'aurore'],
    [7, 'toque-de-chef'],
    [10, 'echarpe'],
    [14, 'tablier'],
    [15, 'cosmos'],
    [21, 'bonnet'],
    [30, 'couronne-de-fruits'],
    [45, 'arc-en-ciel'],
  ])('à %i jours, « %s » est débloqué (et pas la veille)', (days, id) => {
    expect(unlockedAt(days).split(',')).toContain(id);
    expect(unlockedAt(days - 1).split(',')).not.toContain(id);
  });

  it('tout est débloqué à 45 jours', () => {
    expect(unlockedItems(run(45))).toHaveLength(COMPANION_CATALOG.length);
  });

  it('les déblocages suivent le record : une série interrompue ne reperd rien', () => {
    const broken = recordActivity(run(14), '2026-02-20');
    expect(broken.streak).toBe(1);
    expect(unlockedItems(broken)).toEqual(unlockedItems(run(14)));
  });
});

describe('newlyUnlockedItems et acknowledge', () => {
  it('signale les nouveautés jusqu’à acquittement, une seule fois', () => {
    expect(newlyUnlockedItems(INITIAL_COMPANION_STATE)).toEqual([]);
    const day1 = play('2026-03-10');
    expect(ids(newlyUnlockedItems(day1))).toEqual(['feuille']);
    const seen = acknowledge(day1);
    expect(newlyUnlockedItems(seen)).toEqual([]);
    expect(acknowledge(seen)).toBe(seen);
    const later = recordActivity(recordActivity(seen, '2026-03-11'), '2026-03-12');
    expect(ids(newlyUnlockedItems(later))).toEqual(['lunettes-rondes']);
  });

  it('plusieurs déblocages d’un coup', () => {
    expect(ids(newlyUnlockedItems(run(5)))).toEqual(['aurore', 'feuille', 'lunettes-rondes']);
  });
});

describe('nextUnlock', () => {
  it('compte les jours restants depuis la série en cours', () => {
    const state = run(2, '2026-03-10');
    expect(nextUnlock(state, '2026-03-11')).toMatchObject({
      item: { id: 'lunettes-rondes' },
      inDays: 1,
    });
  });

  it('après une interruption, repart de la série à 0', () => {
    const state = run(10, '2026-03-01');
    expect(nextUnlock(state, '2026-03-30')).toMatchObject({ item: { id: 'tablier' }, inDays: 14 });
  });

  it('avant tout geste : la feuille, dans 1 jour', () => {
    expect(nextUnlock(INITIAL_COMPANION_STATE, '2026-03-01')).toMatchObject({
      item: { id: 'feuille' },
      inDays: 1,
    });
  });

  it('plus rien à débloquer à 45 jours', () => {
    const state = run(45, '2026-01-01');
    expect(nextUnlock(state, '2026-02-14')).toBeUndefined();
  });
});

describe('equip', () => {
  const week = run(7);
  const look: CompanionLook = {
    color: 'abricot',
    eyes: 'rieurs',
    accessories: { tete: 'toque-de-chef', visage: 'lunettes-rondes' },
  };

  it('applique une apparence débloquée', () => {
    const result = equip(week, look);
    expect(result).toEqual({ ok: true, state: { ...week, look } });
  });

  it('apparence par défaut toujours acceptée, même sans geste', () => {
    expect(equip(INITIAL_COMPANION_STATE, DEFAULT_LOOK)).toMatchObject({ ok: true });
  });

  it('refuse un accessoire non débloqué, sans rien changer', () => {
    const result = equip(run(6), look);
    expect(result).toMatchObject({ ok: false, reason: 'locked', item: { id: 'toque-de-chef' } });
  });

  it('refuse une teinte spéciale non débloquée, l’accepte au seuil', () => {
    const aurore: CompanionLook = { ...DEFAULT_LOOK, color: 'aurore' };
    expect(equip(run(4), aurore)).toMatchObject({ ok: false, reason: 'locked' });
    expect(equip(run(5), aurore)).toMatchObject({ ok: true });
  });

  it('refuse un accessoire inconnu ou rangé au mauvais emplacement', () => {
    const wrongSlot = {
      ...DEFAULT_LOOK,
      accessories: { cou: 'tablier' },
    } as unknown as CompanionLook;
    expect(equip(run(30), wrongSlot)).toEqual({ ok: false, reason: 'unknown', id: 'tablier' });
    const unknownItem = {
      ...DEFAULT_LOOK,
      accessories: { tete: 'casque' },
    } as unknown as CompanionLook;
    expect(equip(run(30), unknownItem)).toMatchObject({ ok: false, reason: 'unknown' });
  });

  it('refuse une teinte ou des yeux inconnus', () => {
    const color = { ...DEFAULT_LOOK, color: 'noir' } as unknown as CompanionLook;
    const eyes = { ...DEFAULT_LOOK, eyes: 'laser' } as unknown as CompanionLook;
    expect(equip(week, color)).toEqual({ ok: false, reason: 'unknown', id: 'noir' });
    expect(equip(week, eyes)).toEqual({ ok: false, reason: 'unknown', id: 'laser' });
  });

  it('retirer les accessoires est toujours possible ; seules les clés connues sont gardées', () => {
    const dressed = equip(week, look);
    expect(dressed.ok).toBe(true);
    const bare = equip(week, { ...look, accessories: {} });
    expect(bare).toMatchObject({ ok: true, state: { look: { accessories: {} } } });
    const noisy = {
      ...DEFAULT_LOOK,
      extra: 1,
      accessories: { tete: undefined },
    } as unknown as CompanionLook;
    expect(equip(week, noisy)).toEqual({ ok: true, state: { ...week, look: DEFAULT_LOOK } });
  });
});
