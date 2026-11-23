import type { Profile } from '@domain/profile';

export interface ProfileRepository {
  /** `undefined` tant que l'onboarding n'a pas été fait. */
  get(): Promise<Profile | undefined>;
  save(profile: Profile): Promise<void>;
}
