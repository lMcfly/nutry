import { isWeightTrackingEnabledByDefault } from '@domain/profile';
import { computeTrend, recordProgress, summarizeProgress } from '@domain/progress';
import type { EntryCheck, ProgressEntry, ProgressSummary, TrendPoint } from '@domain/progress';
import { startOfWeek } from '@domain/shared';
import type { IsoDate } from '@domain/shared';
import { isWeightTrackingEnabled } from '@domain/userdata';
import type { AppPorts, SerialRunner } from './context';

export interface WeightTrackingStatus {
  /** Suivi du poids effectif (choix explicite, sinon défaut du profil). */
  readonly enabled: boolean;
  /**
   * Valeur par défaut pour ce profil : faux pour tout profil protégé (moins de 18 ans,
   * grossesse ou allaitement, condition de santé, IMC bas), vrai sinon.
   */
  readonly enabledByDefault: boolean;
}

export interface ProgressView {
  /** Mesures triées par date ; sans le poids si son suivi est désactivé. */
  readonly entries: readonly ProgressEntry[];
  readonly summary: ProgressSummary;
  /** Vide si le suivi du poids est désactivé. */
  readonly weightTrend: readonly TrendPoint[];
  readonly waistTrend: readonly TrendPoint[];
  readonly weightTracking: WeightTrackingStatus;
  /** Mesure de la semaine calendaire en cours (jour local du port Clock), s'il y en a une. */
  readonly thisWeekEntry?: ProgressEntry;
}

export interface LogProgressInput {
  /** Aujourd'hui par défaut. */
  readonly date?: IsoDate;
  readonly weightKg?: number;
  readonly waistCm?: number;
}

export const WEIGHT_TRACKING_DISABLED_MESSAGE =
  'Le suivi du poids n’est pas activé : tu peux l’activer dans ton profil si tu le souhaites.';

export interface ProgressUseCases {
  readonly getProgressSummary: () => Promise<ProgressView>;
  /**
   * Un point d'étape par semaine calendaire : `created`, ou `updated` si la semaine en a
   * déjà un (fusion champ par champ, les champs non ressaisis sont conservés).
   */
  readonly logProgress: (input: LogProgressInput) => Promise<EntryCheck>;
  readonly removeProgress: (date: IsoDate) => Promise<void>;
  /** Active ou désactive le suivi du poids (choix explicite de la personne). */
  readonly setWeightTracking: (enabled: boolean) => Promise<WeightTrackingStatus>;
}

function withoutWeight(entry: ProgressEntry): ProgressEntry {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { weightKg, ...rest } = entry;
  return rest;
}

export function createProgressUseCases(ports: AppPorts, serial: SerialRunner): ProgressUseCases {
  const trackingStatus = async (): Promise<WeightTrackingStatus> => {
    const [profile, settings] = await Promise.all([ports.profiles.get(), ports.settings.get()]);
    // Sans profil, prudence : pas de suivi du poids par défaut.
    const enabledByDefault = profile ? isWeightTrackingEnabledByDefault(profile) : false;
    return { enabled: isWeightTrackingEnabled(settings, enabledByDefault), enabledByDefault };
  };

  return {
    async getProgressSummary() {
      const [stored, weightTracking] = await Promise.all([ports.progress.list(), trackingStatus()]);
      const entries = (weightTracking.enabled ? stored : stored.map(withoutWeight)).filter(
        (e) => e.weightKg !== undefined || e.waistCm !== undefined,
      );
      const today = ports.clock.today();
      const thisWeek = startOfWeek(today);
      const thisWeekEntry = entries.find((e) => startOfWeek(e.date) === thisWeek);
      return {
        entries,
        ...(thisWeekEntry ? { thisWeekEntry } : {}),
        summary: summarizeProgress(entries, today),
        weightTrend: weightTracking.enabled ? computeTrend(entries, 'weightKg') : [],
        waistTrend: computeTrend(entries, 'waistCm'),
        weightTracking,
      };
    },

    logProgress: (input) =>
      serial(async () => {
        const { enabled } = await trackingStatus();
        if (!enabled && input.weightKg !== undefined) {
          return { status: 'invalide', message: WEIGHT_TRACKING_DISABLED_MESSAGE };
        }
        const today = ports.clock.today();
        const entry: ProgressEntry = {
          date: input.date ?? today,
          ...(input.weightKg === undefined ? {} : { weightKg: input.weightKg }),
          ...(input.waistCm === undefined ? {} : { waistCm: input.waistCm }),
        };
        // Fusion avec le point d'étape de la semaine : un poids masqué y est conservé.
        const recorded = recordProgress(await ports.progress.list(), entry, today);
        if (recorded.saved) {
          // Écrire d'abord : un échec entre les deux ne perd jamais de mesure.
          await ports.progress.save(recorded.saved);
          if (recorded.replacedDate !== undefined) {
            await ports.progress.remove(recorded.replacedDate);
          }
        }
        return recorded.check;
      }),

    removeProgress: (date) => serial(() => ports.progress.remove(date)),

    setWeightTracking: (enabled) =>
      serial(async () => {
        const settings = await ports.settings.get();
        await ports.settings.save({ ...settings, weightTracking: enabled });
        return trackingStatus();
      }),
  };
}
