import { isWeightTrackingEnabledByDefault } from '@domain/profile';
import { computeTrend, recordProgress, summarizeProgress } from '@domain/progress';
import type { EntryCheck, ProgressEntry, ProgressSummary, TrendPoint } from '@domain/progress';
import type { IsoDate } from '@domain/shared';
import { isWeightTrackingEnabled } from '@domain/userdata';
import type { AppPorts, SerialRunner } from './context';

export interface WeightTrackingStatus {
  /** Suivi du poids effectif (choix explicite, sinon défaut du profil). */
  readonly enabled: boolean;
  /** Valeur par défaut pour ce profil (faux avant 18 ans ou avec une condition de santé). */
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
}

export interface LogProgressInput {
  /** Aujourd'hui par défaut. */
  readonly date?: IsoDate;
  readonly weightKg?: number;
  readonly waistCm?: number;
}

export const WEIGHT_TRACKING_DISABLED_MESSAGE =
  'Le suivi du poids est désactivé : tu peux le réactiver dans tes réglages si tu le souhaites.';

export interface ProgressUseCases {
  readonly getProgressSummary: () => Promise<ProgressView>;
  /** Une mesure par semaine calendaire ; une saisie à la même date corrige la précédente. */
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
      return {
        entries,
        summary: summarizeProgress(entries, ports.clock.today()),
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
        const date = input.date ?? today;
        const existing = await ports.progress.list();
        // Suivi du poids désactivé : une correction ne doit pas effacer le poids masqué.
        const hiddenWeight = enabled ? undefined : existing.find((e) => e.date === date)?.weightKg;
        const weightKg = input.weightKg ?? hiddenWeight;
        const entry: ProgressEntry = {
          date,
          ...(weightKg === undefined ? {} : { weightKg }),
          ...(input.waistCm === undefined ? {} : { waistCm: input.waistCm }),
        };
        const check = recordProgress(existing, enabled ? entry : withoutWeight(entry), today).check;
        if (check.status === 'nouvelle' || check.status === 'correction') {
          await ports.progress.save(entry);
        }
        return check;
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
