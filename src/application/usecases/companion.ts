import {
  COMPANION_MESSAGES,
  acknowledge,
  companionMessage,
  currentStreak,
  equip,
  moodOf,
  newlyUnlockedItems,
  nextUnlock,
  recordActivity,
  unlockedItems,
} from '@domain/companion';
import { completedSessionCount } from '@domain/training';
import type { CompanionItem, CompanionLook, CompanionMood, NextUnlock } from '@domain/companion';
import type { AppPorts, SerialRunner } from './context';

/** Ce que l'interface affiche de Nutry. */
export interface CompanionView {
  readonly look: CompanionLook;
  readonly mood: CompanionMood;
  /** Message court et bienveillant (tutoiement) associé à l'humeur. */
  readonly message: string;
  /** Série en cours (0 si interrompue). */
  readonly streak: number;
  /** Record de série. */
  readonly best: number;
  /** Séances de Sport terminées, toutes semaines confondues (accessoires sportifs). */
  readonly sessionsCompleted: number;
  /** Tout ce qui est débloqué (teintes, yeux, accessoires), d'après le record. */
  readonly unlocked: readonly CompanionItem[];
  readonly nextUnlock: NextUnlock | undefined;
  /** Déblocages pas encore célébrés, jusqu'à `acknowledgeUnlocks()`. */
  readonly newlyUnlocked: readonly CompanionItem[];
}

export type CustomizeResult =
  | { readonly status: 'saved'; readonly companion: CompanionView }
  | {
      readonly status: 'refused';
      readonly reason: 'locked' | 'unknown';
      /** Message doux, prêt à afficher. */
      readonly message: string;
    };

export interface CompanionUseCases {
  readonly getCompanion: () => Promise<CompanionView>;
  /** Applique une apparence ; refuse un élément inconnu ou pas encore débloqué. */
  readonly customizeCompanion: (look: CompanionLook) => Promise<CustomizeResult>;
  /** Marque les déblocages courants comme célébrés (`newlyUnlocked` redevient vide). */
  readonly acknowledgeUnlocks: () => Promise<CompanionView>;
}

/**
 * Note un geste (quiz répondu, repas noté, article coché) pour la série du jour.
 * À appeler depuis un cas d'usage DÉJÀ sérialisé (aucun verrou ici : interblocage sinon).
 * Au mieux : un échec du compagnon ne doit jamais faire échouer le geste lui-même.
 */
export async function recordCompanionActivity(ports: AppPorts): Promise<void> {
  try {
    const state = await ports.companion.get();
    const next = recordActivity(state, ports.clock.today());
    if (next !== state) await ports.companion.save(next);
  } catch {
    // Geste déjà enregistré par l'appelant ; la série se rattrapera au prochain geste.
  }
}

/** Séances terminées (journaux du Sport) ; 0 si la lecture échoue : la série reste utilisable. */
async function sessionsCompleted(ports: AppPorts): Promise<number> {
  try {
    return completedSessionCount(await ports.sessionLogs.listAll());
  } catch {
    return 0;
  }
}

export function createCompanionUseCases(ports: AppPorts, serial: SerialRunner): CompanionUseCases {
  const view = async (): Promise<CompanionView> => {
    const state = await ports.companion.get();
    const today = ports.clock.today();
    const sessions = await sessionsCompleted(ports);
    return {
      look: state.look,
      mood: moodOf(state, today),
      message: companionMessage(state, today),
      streak: currentStreak(state, today),
      best: state.best,
      sessionsCompleted: sessions,
      unlocked: unlockedItems(state, sessions),
      nextUnlock: nextUnlock(state, today),
      newlyUnlocked: newlyUnlockedItems(state),
    };
  };

  return {
    getCompanion: () => serial(view),

    customizeCompanion: (look) =>
      serial(async () => {
        const result = equip(await ports.companion.get(), look, await sessionsCompleted(ports));
        if (!result.ok) {
          return {
            status: 'refused',
            reason: result.reason,
            message:
              result.reason === 'locked' ? COMPANION_MESSAGES.locked : COMPANION_MESSAGES.unknown,
          };
        }
        await ports.companion.save(result.state);
        return { status: 'saved', companion: await view() };
      }),

    acknowledgeUnlocks: () =>
      serial(async () => {
        const state = await ports.companion.get();
        const next = acknowledge(state);
        if (next !== state) await ports.companion.save(next);
        return view();
      }),
  };
}
