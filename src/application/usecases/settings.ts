import { THEMES } from '@domain/userdata';
import type { Theme, UserSettings } from '@domain/userdata';
import type { ResolvedPorts, SerialRunner } from './context';

/** Clés du stockage d'appareil (port `DeviceStorage`), hors base de données. */
export const DEVICE_KEYS = {
  /** Copie du thème (portée `local`) : appliquée avant que la base ne réponde. */
  theme: 'theme',
  /** Carte de la question du moment déjà ouverte dans cette session (portée `session`). */
  quizShown: 'quiz.session',
  /**
   * Identifiant de la session (ouverture de l'app) pour le quiz (portée `session`) : une
   * nouvelle ouverture n'en a pas encore, donc tire une nouvelle question.
   */
  quizSessionId: 'quiz.session-id',
  /** Rappel de sauvegarde masqué pour cette session (portée `session`). */
  backupReminderDismissed: 'backup-reminder.dismissed',
  /** Corps du mannequin des exercices choisi par la personne (portée `local`, ADR 0015). */
  exerciseBody: 'sport.mannequin',
} as const;

/** Corps du mannequin des exercices, quand le profil ne le fixe pas (sexe « autre »). */
export const EXERCISE_BODIES = ['femme', 'homme'] as const;
export type ExerciseBody = (typeof EXERCISE_BODIES)[number];

const isExerciseBody = (value: string | undefined): value is ExerciseBody =>
  (EXERCISE_BODIES as readonly (string | undefined)[]).includes(value);

const isTheme = (value: string | undefined): value is Theme =>
  (THEMES as readonly (string | undefined)[]).includes(value);

export interface SettingsUseCases {
  readonly getSettings: () => Promise<UserSettings>;
  /** Enregistre le thème et en garde une copie sur l'appareil (affichage sans flash). */
  readonly setTheme: (theme: Theme) => Promise<UserSettings>;
  /** Copie du thème gardée sur l'appareil, lisible tout de suite (synchrone). */
  readonly cachedTheme: () => Theme | undefined;
  /**
   * Vrai la première fois dans la session de navigateur, et le note : la carte de la
   * question du moment s'ouvre une fois par ouverture de l'app, pas à chaque changement
   * d'onglet ni à chaque rechargement.
   */
  readonly claimQuizForSession: () => boolean;
  /** Note la carte du quiz comme montrée (fin de l'onboarding : place au menu). */
  readonly markQuizShown: () => void;
  /**
   * Demande au navigateur de ne pas évincer les données. À appeler APRÈS l'onboarding,
   * dans le gestionnaire du clic final (jamais au premier chargement).
   */
  readonly requestPersistentStorage: () => Promise<boolean>;
  /** Le stockage est-il déjà persistant ? (écran Confidentialité) */
  readonly isStoragePersisted: () => Promise<boolean>;
  /** Corps du mannequin choisi sur cet appareil (absent : celui du profil, ou par défaut). */
  readonly exerciseBody: () => ExerciseBody | undefined;
  readonly setExerciseBody: (body: ExerciseBody) => void;
}

export function createSettingsUseCases(
  ports: ResolvedPorts,
  serial: SerialRunner,
): SettingsUseCases {
  const patch = (change: Partial<UserSettings>) =>
    serial(async () => {
      const next = { ...(await ports.settings.get()), ...change };
      await ports.settings.save(next);
      return next;
    });

  const markQuizShown = () => {
    ports.device.set('session', DEVICE_KEYS.quizShown, '1');
  };

  return {
    getSettings: () => ports.settings.get(),

    setTheme: (theme) => {
      ports.device.set('local', DEVICE_KEYS.theme, theme);
      return patch({ theme });
    },

    cachedTheme() {
      const value = ports.device.get('local', DEVICE_KEYS.theme);
      return isTheme(value) ? value : undefined;
    },

    claimQuizForSession() {
      if (ports.device.get('session', DEVICE_KEYS.quizShown) === '1') return false;
      markQuizShown();
      return true;
    },

    markQuizShown,

    async requestPersistentStorage() {
      const granted = await ports.persistence.request();
      await patch({ persistenceGranted: granted });
      return granted;
    },

    isStoragePersisted: () => ports.persistence.isPersisted(),

    exerciseBody() {
      const value = ports.device.get('local', DEVICE_KEYS.exerciseBody);
      return isExerciseBody(value) ? value : undefined;
    },

    setExerciseBody(body) {
      if (isExerciseBody(body)) ports.device.set('local', DEVICE_KEYS.exerciseBody, body);
    },
  };
}
