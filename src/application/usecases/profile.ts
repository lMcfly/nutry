import { MEDICAL_DISCLAIMER, assessEnergy, normalizeGoal, validateProfile } from '@domain/profile';
import type { EnergyAssessment, HealthMessage, Profile, ProfileIssue } from '@domain/profile';
import type { AppPorts, SerialRunner } from './context';

/**
 * Garde-fous de santé à afficher, SANS chiffre de calories (PROMPT §3.2) : messages
 * bienveillants, objectif « perdre » grisé ou non, profil protégé.
 */
export interface HealthSummary {
  readonly messages: readonly HealthMessage[];
  /** Faux : l'objectif « perdre en douceur » doit être grisé. */
  readonly lossAllowed: boolean;
  readonly protectedProfile: boolean;
  readonly weightTrackingEnabledByDefault: boolean;
  /** Bandeau permanent de l'écran Profil. */
  readonly disclaimer: string;
}

/** Détail chiffré, à n'afficher que dans un panneau optionnel (« Voir le détail »). */
export interface EnergyDetail {
  readonly bmi: number;
  readonly waistToHeightRatio?: number;
  readonly bmrKcal: number;
  readonly needsKcal: number;
  readonly targetKcal: number;
  readonly deficitApplied: boolean;
}

export interface ProfileView {
  readonly profile: Profile;
  readonly health: HealthSummary;
  readonly energyDetail: EnergyDetail;
}

export interface ProfilePreview {
  /** Champs à corriger avant d'enregistrer (vide si tout va bien). */
  readonly issues: readonly ProfileIssue[];
  /** Absent tant que le profil comporte des erreurs. */
  readonly health?: HealthSummary;
}

export type SaveProfileResult =
  | { readonly status: 'invalid'; readonly issues: readonly ProfileIssue[] }
  | {
      readonly status: 'saved';
      readonly view: ProfileView;
      /**
       * Premier enregistrement (fin de l'onboarding) : c'est le moment d'appeler
       * `requestPersistentStorage`, dans le gestionnaire du clic.
       */
      readonly firstProfile: boolean;
    };

export interface ProfileUseCases {
  readonly getProfile: () => Promise<ProfileView | undefined>;
  /** Aperçu pendant la saisie (onboarding, écran Profil) : erreurs et garde-fous. */
  readonly previewProfile: (profile: Profile) => ProfilePreview;
  /**
   * Enregistre le profil. L'objectif est normalisé (`normalizeGoal`) : « perdre en douceur »
   * redevient « rééquilibrer » pour un profil protégé ; `view.profile` donne la valeur retenue.
   */
  readonly saveProfile: (profile: Profile) => Promise<SaveProfileResult>;
}

function toHealthSummary(a: EnergyAssessment): HealthSummary {
  return {
    messages: a.messages,
    lossAllowed: a.perteAutorisee,
    protectedProfile: a.protectedProfile,
    weightTrackingEnabledByDefault: a.weightTrackingEnabledByDefault,
    disclaimer: MEDICAL_DISCLAIMER,
  };
}

function toEnergyDetail(a: EnergyAssessment): EnergyDetail {
  return {
    bmi: a.bmi,
    ...(a.waistToHeightRatio === undefined ? {} : { waistToHeightRatio: a.waistToHeightRatio }),
    bmrKcal: a.bmrKcal,
    needsKcal: a.needsKcal,
    targetKcal: a.targetKcal,
    deficitApplied: a.deficitApplied,
  };
}

export function toProfileView(profile: Profile): ProfileView {
  const assessment = assessEnergy(profile);
  return {
    profile,
    health: toHealthSummary(assessment),
    energyDetail: toEnergyDetail(assessment),
  };
}

export function createProfileUseCases(ports: AppPorts, serial: SerialRunner): ProfileUseCases {
  return {
    async getProfile() {
      const profile = await ports.profiles.get();
      return profile ? toProfileView(profile) : undefined;
    },

    previewProfile(profile) {
      const issues = validateProfile(profile);
      return issues.length > 0
        ? { issues }
        : { issues, health: toHealthSummary(assessEnergy(profile)) };
    },

    saveProfile: (input) =>
      serial(async () => {
        const issues = validateProfile(input);
        if (issues.length > 0) return { status: 'invalid', issues };
        // Garde-fous : un profil protégé ne garde jamais l'objectif « perdre en douceur ».
        const profile = normalizeGoal(input);
        const [previous, settings] = await Promise.all([
          ports.profiles.get(),
          ports.settings.get(),
        ]);
        await ports.profiles.save(profile);
        const firstProfile = previous === undefined;
        if (settings.profileCreatedAt === undefined) {
          await ports.settings.save({
            ...settings,
            profileCreatedAt: ports.clock.now().toISOString(),
          });
        }
        // Le menu de la semaine se régénère au prochain affichage si les contraintes
        // alimentaires ont changé (empreinte stockée avec le menu).
        return { status: 'saved', view: toProfileView(profile), firstProfile };
      }),
  };
}
