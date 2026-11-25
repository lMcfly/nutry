import type { CreativeCommonsLicense, ExerciseLicense, VideoLicense } from '@application/ports';

/**
 * Adresses des pages de licence des exercices et de leurs vidéos. Fichier sans Zod : l'adaptateur
 * `StaticExerciseCatalog` l'importe sans alourdir le paquet initial (le schéma est chargé à la
 * demande avec le JSON).
 * Licence du dépôt (MIT) : page de référence de l'OSI ; le texte intégral est le fichier
 * `LICENSE` à la racine du dépôt. La garde de confidentialité (`privacy.qa.test.ts`) n'admet
 * que cette adresse, les pages Creative Commons, Mixkit et Coverr.
 */
export const EXERCISE_LICENSE_URLS: Readonly<Record<ExerciseLicense, string>> = {
  MIT: 'https://opensource.org/licenses/MIT',
};

const CC_LICENSE_URLS: Readonly<Record<CreativeCommonsLicense, string>> = {
  'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC-BY-SA-3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC-BY-SA-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
};

export const VIDEO_LICENSE_URLS: Readonly<Record<VideoLicense, string>> = {
  ...EXERCISE_LICENSE_URLS,
  ...CC_LICENSE_URLS,
  Mixkit: 'https://mixkit.co/license/',
  Coverr: 'https://coverr.co/license',
};
