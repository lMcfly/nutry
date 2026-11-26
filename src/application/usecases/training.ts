import { daysBetween, startOfWeek, isIsoDate } from '@domain/shared';
import type { IsoDate } from '@domain/shared';
import {
  ACTIVITY_SUGGESTION_SNOOZE_DAYS,
  suggestActivityLevel,
  weeklyTrainingMinutes,
  ALWAYS_AVAILABLE_EQUIPMENT,
  EFFORT_FEELINGS,
  TRAINING_DISCLAIMER,
  assessTrainingSafety,
  asksPregnancyStage,
  avoidedExerciseIds,
  buildTrainingProfile,
  completedSessionCount,
  defaultTrainingInput,
  finishSessionLog,
  findAlternatives,
  historyByExercise,
  isExerciseEligible,
  isSessionComplete,
  logSet as logSetInSession,
  markExerciseDone as markExerciseDoneInSession,
  newSportAccessories,
  nextSportAccessory,
  painAvoidanceEnd,
  painMessages,
  planTrainingWeek,
  prescribe,
  replaceExerciseInLog,
  replaceInPlan,
  sessionCompletion,
  sessionHistory,
  sessionLogId,
  startSessionLog,
  trainingConstraintsKey,
  trainingDaysOf,
  trainingInputOf,
  unlockedSportAccessories,
  validateTrainingInput,
} from '@domain/training';
import type {
  EffortFeeling,
  EligibilityContext,
  Exercise,
  PlannedExercise,
  PlannedSession,
  SavedTrainingPlan,
  SessionHistoryEntry,
  SessionLog,
  SetLog,
  SportAccessoryUnlock,
  TrainingDaysForMeals,
  TrainingInputIssue,
  TrainingProfile,
  TrainingProfileInput,
  TrainingSafety,
  TrainingSafetyMessage,
} from '@domain/training';
import type { DayIndex } from '@domain/mealplan';
import type { ActivityLevel, Profile } from '@domain/profile';
import type { ExerciseCredit, ExerciseMedia, ExerciseVideo } from '../ports';
import { NO_PROFILE } from './context';
import type { AppPorts, NoProfile, SerialRunner } from './context';
import { recordCompanionActivity } from './companion';
import type { PlanOrigin } from './plan';

// ------------------------------------------------------------------------ Textes (ADR 0010)

/** Messages doux quand le stockage ou le catalogue d'exercices échoue (rien n'est perdu). */
export const TRAINING_FAILURE_MESSAGES = {
  load: 'Le Sport n’a pas pu se charger (stockage de l’appareil ou fiches d’exercices indisponibles). Tes données sont intactes : réessaie dans un instant.',
  save: 'Ça n’a pas pu être enregistré (stockage de l’appareil indisponible ou plein). Tes données précédentes sont intactes : réessaie dans un instant.',
} as const;

export const TRAINING_MESSAGES = {
  unavailable: 'Cette séance n’est plus dans ton programme.',
  unavailableExercise: 'Cet exercice n’est plus dans ta séance.',
  invalidSet: 'Ces valeurs ne sont pas possibles pour une série.',
  nothingDone:
    'Aucune série n’est cochée pour l’instant : coche au moins une série pour terminer ta séance, ou quitte simplement l’écran, rien n’est perdu.',
  noReplacement:
    'Je n’ai pas trouvé de remplaçant adapté à ton matériel et à ta situation : passe cet exercice, ou garde-le plus léger.',
} as const;

/** Texte de l'écran « Crédits exercices » (ADR 0010 : indissociable de la licence). */
export const EXERCISE_CREDITS_TEXTS = {
  title: 'Crédits exercices',
  subtitle: 'Des fiches et des dessins faits pour Nutry.',
  intro:
    'Les fiches d’exercices (noms, consignes, conseils) et les mannequins dessinés sont le contenu propre de Nutry, sous licence MIT, comme le reste de l’application.',
  license: 'Licence MIT',
  videosTitle: 'Vidéos',
  noVideos:
    'Aucune vidéo n’est installée pour le moment : les mannequins montrent chaque mouvement.',
  externalLink:
    'Le lien « Chercher une vidéo sur YouTube (site externe) » ouvre une recherche dans un nouvel onglet : Nutry n’envoie aucune donnée.',
  disclaimer: TRAINING_DISCLAIMER,
} as const;

// ------------------------------------------------------------------------------ Résultats

/** Le Sport n'est pas activé (pas de profil sportif). */
export interface SportInactive {
  readonly status: 'inactive';
}
export const SPORT_INACTIVE: SportInactive = { status: 'inactive' };

/** Échec technique (stockage, catalogue) : message doux, données intactes. */
export interface TrainingFailure {
  readonly status: 'failed';
  readonly message: string;
}

/** Séance, exercice ou valeur introuvable ou refusée, avec un message prêt à afficher. */
export interface TrainingUnavailable {
  readonly status: 'unavailable';
  readonly message: string;
}

export interface TrainingOnboardingView {
  readonly status: 'inactive';
  /** Poser la question de l'étape de grossesse (grossesse ou allaitement déclarés). */
  readonly askPregnancyStage: boolean;
  /** Réponses proposées d'emblée. */
  readonly defaults: TrainingProfileInput;
}

export interface TrainingProfileView {
  readonly status: 'active';
  readonly profile: TrainingProfile;
  /** Réponses modifiables (l'écran « matériel et jours »). */
  readonly input: TrainingProfileInput;
  readonly askPregnancyStage: boolean;
  readonly safety: TrainingSafety;
  /** Messages de prudence à lire (« J'ai compris ») avant la première séance. */
  readonly needsAcknowledgement: boolean;
  readonly disclaimer: string;
}

export type TrainingProfileResult = NoProfile | TrainingOnboardingView | TrainingProfileView;

export type SaveTrainingProfileResult =
  | NoProfile
  | { readonly status: 'invalid'; readonly issues: readonly TrainingInputIssue[] }
  | (Omit<TrainingProfileView, 'status'> & { readonly status: 'saved' })
  | TrainingFailure;

export interface TrainingWeekView {
  readonly status: 'ready';
  readonly plan: SavedTrainingPlan;
  /** `generated` : première fois cette semaine ; `regenerated` : contraintes changées. */
  readonly origin: PlanOrigin;
  readonly today: IsoDate;
  /** Exercices du programme et de leurs remplacements, par identifiant. */
  readonly exercises: Readonly<Record<string, Exercise>>;
  /** Journaux de la semaine, par identifiant de séance. */
  readonly logs: Readonly<Record<string, SessionLog>>;
  /** Séances terminées cette semaine, sur les séances prévues. */
  readonly doneSessions: number;
  readonly plannedSessions: number;
  readonly trainingDays: TrainingDaysForMeals;
  readonly safety: TrainingSafety;
  readonly needsAcknowledgement: boolean;
  readonly disclaimer: string;
}

export type TrainingWeekResult = NoProfile | SportInactive | TrainingWeekView | TrainingFailure;

/** Une séance du programme, avec son journal une fois commencée. */
export interface TrainingSessionView {
  readonly status: 'ready';
  readonly weekStart: IsoDate;
  readonly session: PlannedSession;
  readonly log: SessionLog | undefined;
  readonly exercises: Readonly<Record<string, Exercise>>;
  /** Séries faites et prévues (exercices principaux), `ratio` de 0 à 1 ; vide avant le début. */
  readonly completion: {
    readonly doneSets: number;
    readonly plannedSets: number;
    readonly ratio: number;
  };
  /** Tous les exercices principaux sont faits : on peut proposer « Terminer ». */
  readonly complete: boolean;
  readonly disclaimer: string;
}

export type ActiveSessionView = TrainingSessionView & { readonly log: SessionLog };

export type TrainingSessionResult =
  NoProfile | SportInactive | TrainingSessionView | TrainingUnavailable | TrainingFailure;

export type ActiveSessionResult =
  NoProfile | SportInactive | ActiveSessionView | TrainingUnavailable | TrainingFailure;

export type ExerciseAlternativesResult =
  | NoProfile
  | SportInactive
  | { readonly status: 'ready'; readonly alternatives: readonly Exercise[] }
  | TrainingUnavailable
  | TrainingFailure;

export type PainResult =
  | NoProfile
  | SportInactive
  | {
      readonly status: 'reported';
      /** Arrête, gêne ≠ douleur vive, urgence ; `douleur-repetee` si la zone revient. */
      readonly messages: readonly TrainingSafetyMessage[];
      /** Premier jour où l'exercice est de nouveau proposé. */
      readonly avoidedUntil: IsoDate;
      /** Exercice mis à la place ; absent s'il n'existe aucun remplaçant adapté. */
      readonly replacement?: Exercise;
      readonly session: ActiveSessionView;
    }
  | TrainingUnavailable
  | TrainingFailure;

export type CompleteSessionResult =
  | NoProfile
  | SportInactive
  | {
      readonly status: 'completed';
      readonly session: ActiveSessionView;
      /** Séances terminées, toutes semaines confondues. */
      readonly sessionsCompleted: number;
      /** Accessoires de Nutry débloqués par cette séance. */
      readonly newAccessories: readonly SportAccessoryUnlock[];
    }
  /** Aucune série cochée : la séance n'est pas terminée (rien n'est enregistré de plus). */
  | { readonly status: 'nothing-done'; readonly message: string }
  | TrainingUnavailable
  | TrainingFailure;

export interface ExerciseSheet {
  readonly exercise: Exercise;
  readonly media: ExerciseMedia | undefined;
  readonly disclaimer: string;
}

export interface ExerciseCreditsView {
  readonly texts: typeof EXERCISE_CREDITS_TEXTS;
  readonly exerciseCount: number;
  /** Crédit commun des fiches (contenu Nutry, MIT) ; absent si le catalogue est vide. */
  readonly credit: ExerciseCredit | undefined;
  readonly videos: readonly {
    readonly exerciseId: string;
    readonly exerciseName: string;
    readonly video: ExerciseVideo;
  }[];
}

export interface TrainingHistoryView {
  /** Du plus récent au plus ancien. */
  readonly entries: readonly SessionHistoryEntry[];
  readonly sessionsCompleted: number;
}

export interface SportRewardsView {
  readonly sessionsCompleted: number;
  readonly unlocked: readonly SportAccessoryUnlock[];
  readonly next:
    { readonly accessory: SportAccessoryUnlock; readonly remaining: number } | undefined;
}

/** Niveau d'activité suggéré par le programme de Sport (un cran au plus). */
export interface ActivitySuggestion {
  readonly current: ActivityLevel;
  readonly suggested: ActivityLevel;
  /** Fréquence × durée prévues, en minutes par semaine. */
  readonly weeklyMinutes: number;
}

export type ActivitySuggestionResult =
  { readonly status: 'updated'; readonly level: ActivityLevel } | { readonly status: 'none' };

export interface SessionRef {
  readonly weekStart: IsoDate;
  readonly sessionId: string;
}
export interface SlotRef extends SessionRef {
  readonly slotId: string;
}

export interface TrainingUseCases {
  /** Profil sportif (ou, sans lui, ce qu'il faut à l'onboarding Sport). */
  readonly getTrainingProfile: () => Promise<TrainingProfileResult>;
  /** Enregistre les réponses de l'onboarding (ou leur modification) après validation. */
  readonly saveTrainingProfile: (input: TrainingProfileInput) => Promise<SaveTrainingProfileResult>;
  /** « J'ai compris » : note la lecture des messages de prudence. */
  readonly acknowledgeTrainingSafety: () => Promise<TrainingProfileResult | TrainingFailure>;
  /** Programme de la semaine en cours : enregistré, sinon généré ; régénéré si l'empreinte change. */
  readonly getTrainingWeek: () => Promise<TrainingWeekResult>;
  /** Jours de séance de la semaine en cours (lien avec la Nourriture) ; absent sans Sport. */
  readonly getTrainingDays: () => Promise<TrainingDaysForMeals | undefined>;
  readonly getTrainingSession: (input: SessionRef) => Promise<TrainingSessionResult>;
  /** Commence la séance (ou reprend son journal si elle est déjà commencée). */
  readonly startSession: (input: SessionRef) => Promise<ActiveSessionResult>;
  /** Enregistre une série (cochée ou non, avec répétitions, secondes ou charge). */
  readonly logSet: (input: SlotRef & { readonly set: SetLog }) => Promise<ActiveSessionResult>;
  /** « Fait » pour tout l'exercice. */
  readonly markExerciseDone: (input: SlotRef) => Promise<ActiveSessionResult>;
  /** Jusqu'à trois remplaçants adaptés pour l'exercice d'un créneau. */
  readonly getExerciseAlternatives: (input: SlotRef) => Promise<ExerciseAlternativesResult>;
  /** Remplace l'exercice par l'un des remplaçants proposés. */
  readonly replaceExercise: (
    input: SlotRef & { readonly exerciseId: string },
  ) => Promise<ActiveSessionResult>;
  /** « Ça fait mal » : écarte l'exercice 28 jours, rend les messages et le remplace. */
  readonly reportPain: (input: SlotRef) => Promise<PainResult>;
  /** Termine la séance ; elle compte comme geste de la série de Nutry. */
  readonly completeSession: (
    input: SessionRef & { readonly effort?: EffortFeeling },
  ) => Promise<CompleteSessionResult>;
  readonly getExerciseSheet: (exerciseId: string) => Promise<ExerciseSheet | undefined>;
  readonly listExerciseCredits: () => Promise<ExerciseCreditsView>;
  readonly getTrainingHistory: () => Promise<TrainingHistoryView>;
  /** Accessoires sportifs de Nutry, d'après le nombre cumulé de séances terminées. */
  readonly getSportRewards: () => Promise<SportRewardsView>;
  /**
   * Suggestion de relever d'UN cran le niveau d'activité du profil (carte dans « Moi ») : le
   * programme prévoit plus d'entraînement que le niveau déclaré. `undefined` : rien à proposer
   * (Sport inactif, niveau suffisant, ou refusée récemment).
   */
  readonly getActivitySuggestion: () => Promise<ActivitySuggestion | undefined>;
  /**
   * Accepte la suggestion (recalculée ici, jamais lue du client) : met le profil à jour d'un
   * cran ; la suivante ne vient pas avant `ACTIVITY_SUGGESTION_SNOOZE_DAYS` jours.
   */
  readonly acceptActivitySuggestion: () => Promise<ActivitySuggestionResult>;
  /** Refuse la suggestion : elle ne revient pas avant `ACTIVITY_SUGGESTION_SNOOZE_DAYS` jours. */
  readonly dismissActivitySuggestion: () => Promise<void>;
  /** Garde l'écran allumé pendant la séance ; faux si le navigateur ne sait pas (sans erreur). */
  readonly keepScreenOn: () => Promise<boolean>;
  readonly releaseScreen: () => Promise<void>;
}

// ---------------------------------------------------------------------------- Contexte

interface TrainingContext {
  readonly profile: Profile;
  readonly training: TrainingProfile;
  readonly catalog: readonly Exercise[];
  readonly byId: ReadonlyMap<string, Exercise>;
  readonly safety: TrainingSafety;
}

type Loaded =
  NoProfile | SportInactive | { readonly status: 'ready'; readonly ctx: TrainingContext };

/**
 * Jours de séance de la semaine en cours pour la Nourriture (ADR 0015) ; vide sans Sport.
 * À appeler depuis une tâche déjà sérialisée (écrit le programme s'il n'existe pas encore).
 * Au mieux : le lien avec la Nourriture est facultatif, une erreur ne bloque jamais le menu.
 */
export async function trainingDaysFor(ports: AppPorts): Promise<readonly DayIndex[]> {
  try {
    const loaded = await loadContext(ports);
    if (loaded.status !== 'ready') return [];
    return trainingDaysOf((await ensureWeek(ports, loaded.ctx)).plan).trainingDays;
  } catch {
    return [];
  }
}

async function loadContext(ports: AppPorts): Promise<Loaded> {
  const [profile, training] = await Promise.all([
    ports.profiles.get(),
    ports.training.getProfile(),
  ]);
  if (!profile) return NO_PROFILE;
  if (!training) return SPORT_INACTIVE;
  const catalog = await ports.exercises.getExercises();
  return {
    status: 'ready',
    ctx: {
      profile,
      training,
      catalog,
      byId: new Map(catalog.map((exercise) => [exercise.id, exercise])),
      safety: assessTrainingSafety(profile, training),
    },
  };
}

const equipmentOf = (training: TrainingProfile) => [
  ...new Set([...training.equipment, ...ALWAYS_AVAILABLE_EQUIPMENT]),
];

function eligibilityFor(
  ctx: TrainingContext,
  item: Pick<PlannedExercise, 'pattern' | 'role'>,
  avoided: readonly string[],
): EligibilityContext {
  return {
    pattern: item.pattern,
    role: item.role,
    level: ctx.training.level,
    equipment: equipmentOf(ctx.training),
    safety: ctx.safety,
    avoidedExerciseIds: avoided,
  };
}

/** Tous les exercices du programme existent encore et passent les filtres durs actuels. */
function isPlanUsable(plan: SavedTrainingPlan, ctx: TrainingContext, avoided: readonly string[]) {
  return plan.sessions.every((session) =>
    [...session.warmup, ...session.main, ...session.cooldown].every((item) => {
      const exercise = ctx.byId.get(item.exerciseId);
      return (
        exercise !== undefined && isExerciseEligible(exercise, eligibilityFor(ctx, item, avoided))
      );
    }),
  );
}

async function ensureWeek(
  ports: AppPorts,
  ctx: TrainingContext,
): Promise<{ readonly plan: SavedTrainingPlan; readonly origin: PlanOrigin }> {
  const today = ports.clock.today();
  const weekStart = startOfWeek(today);
  const [stored, logs, painReports] = await Promise.all([
    ports.training.getPlan(weekStart),
    ports.sessionLogs.listAll(),
    ports.painReports.list(),
  ]);
  const key = trainingConstraintsKey(ctx.profile, ctx.training);
  const avoided = avoidedExerciseIds(painReports, today);
  if (stored && stored.constraintsKey === key && isPlanUsable(stored, ctx, avoided)) {
    return { plan: stored, origin: 'stored' };
  }
  const plan: SavedTrainingPlan = {
    ...planTrainingWeek({
      weekStart,
      profile: ctx.profile,
      training: ctx.training,
      catalog: ctx.catalog,
      logs,
      painReports,
      today,
    }),
    constraintsKey: key,
    generatedAt: ports.clock.now().toISOString(),
  };
  await ports.training.savePlan(plan);
  return { plan, origin: stored ? 'regenerated' : 'generated' };
}

function exercisesOf(
  ctx: TrainingContext,
  plan: SavedTrainingPlan,
  logs: readonly SessionLog[],
): Record<string, Exercise> {
  const ids = new Set<string>();
  for (const session of plan.sessions) {
    for (const item of [...session.warmup, ...session.main, ...session.cooldown]) {
      ids.add(item.exerciseId);
    }
  }
  for (const log of logs) {
    for (const exercise of log.exercises) {
      ids.add(exercise.exerciseId);
      if (exercise.replacedExerciseId !== undefined) ids.add(exercise.replacedExerciseId);
    }
  }
  const result: Record<string, Exercise> = {};
  for (const id of ids) {
    const exercise = ctx.byId.get(id);
    if (exercise) result[id] = exercise;
  }
  return result;
}

function sessionView(
  ctx: TrainingContext,
  plan: SavedTrainingPlan,
  session: PlannedSession,
  log: SessionLog | undefined,
): TrainingSessionView {
  return {
    status: 'ready',
    weekStart: plan.weekStart,
    session,
    log,
    exercises: exercisesOf(ctx, { ...plan, sessions: [session] }, log ? [log] : []),
    completion: log
      ? sessionCompletion(session, log)
      : {
          doneSets: 0,
          plannedSets: session.main.reduce((n, i) => n + i.prescription.sets, 0),
          ratio: 0,
        },
    complete: log !== undefined && isSessionComplete(session, log),
    disclaimer: TRAINING_DISCLAIMER,
  };
}

function profileView(
  profile: Profile,
  training: TrainingProfile,
): Omit<TrainingProfileView, 'status'> {
  const safety = assessTrainingSafety(profile, training);
  return {
    profile: training,
    input: trainingInputOf(training),
    askPregnancyStage: asksPregnancyStage(profile),
    safety,
    needsAcknowledgement:
      safety.requiresAcknowledgement && training.safetyAcknowledgedOn === undefined,
    disclaimer: TRAINING_DISCLAIMER,
  };
}

/** Bornes des saisies (les mêmes que celles de la sauvegarde importée). */
export const MAX_SETS_PER_EXERCISE = 20;
export const MAX_REPS = 200;
export const MAX_SECONDS = 3_600;
export const MAX_LOAD_KG = 500;

const EFFORT_SET: readonly string[] = EFFORT_FEELINGS;

/** Série reçue de l'interface : bornes de plausibilité, aucune clé inconnue recopiée. */
function sanitizeSet(set: SetLog): SetLog | undefined {
  const within = (value: number | undefined, max: number, integer: boolean): boolean =>
    value === undefined ||
    (Number.isFinite(value) && value >= 0 && value <= max && (!integer || Number.isInteger(value)));
  if (typeof set.done !== 'boolean') return undefined;
  if (!Number.isInteger(set.index) || set.index < 0 || set.index >= MAX_SETS_PER_EXERCISE) {
    return undefined;
  }
  if (!within(set.reps, MAX_REPS, true) || !within(set.seconds, MAX_SECONDS, true))
    return undefined;
  if (!within(set.loadKg, MAX_LOAD_KG, false)) return undefined;
  return {
    index: set.index,
    done: set.done,
    ...(set.reps === undefined ? {} : { reps: set.reps }),
    ...(set.seconds === undefined ? {} : { seconds: set.seconds }),
    ...(set.loadKg === undefined ? {} : { loadKg: set.loadKg }),
  };
}

const unavailable = (message: string): TrainingUnavailable => ({ status: 'unavailable', message });

// ------------------------------------------------------------------------------- Fabrique

/** Suggestion en cours : volume prévu, niveau déclaré, et pas refusée depuis moins de 28 jours. */
async function currentSuggestion(ports: AppPorts): Promise<ActivitySuggestion | undefined> {
  const [profile, training, settings] = await Promise.all([
    ports.profiles.get(),
    ports.training.getProfile(),
    ports.settings.get(),
  ]);
  if (!profile || !training) return undefined;
  const dismissed = settings.activitySuggestionDismissedOn;
  if (
    dismissed !== undefined &&
    daysBetween(dismissed, ports.clock.today()) < ACTIVITY_SUGGESTION_SNOOZE_DAYS
  ) {
    return undefined;
  }
  const suggested = suggestActivityLevel(profile.activity, training);
  if (suggested === undefined) return undefined;
  return {
    current: profile.activity,
    suggested,
    weeklyMinutes: weeklyTrainingMinutes(training),
  };
}

export function createTrainingUseCases(ports: AppPorts, serial: SerialRunner): TrainingUseCases {
  /** Sérialise et rend les échecs techniques en messages doux (jamais d'exception vers l'UI). */
  const run = <T>(kind: 'load' | 'save', task: () => Promise<T>): Promise<T | TrainingFailure> =>
    serial(async () => {
      try {
        return await task();
      } catch {
        return { status: 'failed', message: TRAINING_FAILURE_MESSAGES[kind] } as const;
      }
    });

  /** Programme de la semaine en cours, ou, pour une autre semaine, celui qui est enregistré. */
  async function planOf(ctx: TrainingContext, weekStart: IsoDate) {
    const current = startOfWeek(ports.clock.today());
    if (weekStart === current) return (await ensureWeek(ports, ctx)).plan;
    if (!isIsoDate(weekStart)) return undefined;
    return ports.training.getPlan(weekStart);
  }

  type Opened =
    | NoProfile
    | SportInactive
    | TrainingUnavailable
    | {
        readonly status: 'ready';
        readonly ctx: TrainingContext;
        readonly plan: SavedTrainingPlan;
        readonly session: PlannedSession;
        readonly log: SessionLog | undefined;
      };

  async function open({ weekStart, sessionId }: SessionRef): Promise<Opened> {
    const loaded = await loadContext(ports);
    if (loaded.status !== 'ready') return loaded;
    const plan = await planOf(loaded.ctx, weekStart);
    const session = plan?.sessions.find((s) => s.id === sessionId);
    if (!plan || !session) return unavailable(TRAINING_MESSAGES.unavailable);
    const log = await ports.sessionLogs.get(sessionLogId(plan.weekStart, session.id));
    return { status: 'ready', ctx: loaded.ctx, plan, session, log };
  }

  /** Comme `open`, pour les cas d'usage qui exigent une séance commencée. */
  async function openStarted(
    input: SessionRef,
  ): Promise<
    | NoProfile
    | SportInactive
    | TrainingUnavailable
    | (Extract<Opened, { status: 'ready' }> & { readonly log: SessionLog })
  > {
    const opened = await open(input);
    if (opened.status !== 'ready') return opened;
    if (!opened.log) return unavailable(TRAINING_MESSAGES.unavailable);
    return { ...opened, log: opened.log };
  }

  const active = (
    opened: Extract<Opened, { status: 'ready' }>,
    log: SessionLog,
  ): ActiveSessionView => ({ ...sessionView(opened.ctx, opened.plan, opened.session, log), log });

  const hasSlot = (log: SessionLog, slotId: string): boolean =>
    log.exercises.some((exercise) => exercise.slotId === slotId);

  /** Nouvel exercice à la place d'un autre dans le journal ET le programme enregistré. */
  async function swapExercise(
    opened: Extract<Opened, { status: 'ready' }> & { readonly log: SessionLog },
    slotId: string,
    replacement: Exercise,
  ): Promise<SessionLog> {
    const { ctx, plan, session, log } = opened;
    const planned = session.main.find((item) => item.slotId === slotId);
    if (planned) {
      const history = historyByExercise(await ports.sessionLogs.listAll(), plan.weekStart);
      const fresh = prescribe({
        exercise: replacement,
        role: planned.role,
        goal: ctx.training.goal,
        level: ctx.training.level,
        safety: ctx.safety,
        cycle: plan.cycle,
        history: history.get(replacement.id) ?? [],
      });
      // Le nombre de séries reste celui du journal : les pastilles déjà affichées ne changent pas.
      const prescription = { ...fresh, sets: planned.prescription.sets };
      await ports.training.savePlan(
        replaceInPlan(plan, session.id, slotId, replacement, prescription),
      );
    }
    const next = replaceExerciseInLog(log, slotId, replacement.id);
    await ports.sessionLogs.save(next);
    return next;
  }

  /** Remplaçants du créneau : exercice courant du journal, filtres durs et douleurs comprises. */
  function alternativesFor(
    opened: Extract<Opened, { status: 'ready' }> & { readonly log: SessionLog },
    slotId: string,
    reason: 'choix' | 'douleur',
    avoided: readonly string[],
  ): { readonly current: Exercise; readonly alternatives: Exercise[] } | undefined {
    const { ctx, session, log } = opened;
    const planned = session.main.find((item) => item.slotId === slotId);
    const current = ctx.byId.get(log.exercises.find((e) => e.slotId === slotId)?.exerciseId ?? '');
    if (!planned || !current) return undefined;
    return {
      current,
      alternatives: findAlternatives({
        exercise: current,
        reason,
        catalog: ctx.catalog,
        context: eligibilityFor(ctx, planned, avoided),
      }),
    };
  }

  const weekView = async (
    ctx: TrainingContext,
    plan: SavedTrainingPlan,
    origin: PlanOrigin,
  ): Promise<TrainingWeekView> => {
    const weekLogs = await ports.sessionLogs.listByWeek(plan.weekStart);
    return {
      status: 'ready',
      plan,
      origin,
      today: ports.clock.today(),
      exercises: exercisesOf(ctx, plan, weekLogs),
      logs: Object.fromEntries(weekLogs.map((log) => [log.sessionId, log])),
      doneSessions: weekLogs.filter((log) => log.status === 'terminee').length,
      plannedSessions: plan.sessions.length,
      trainingDays: trainingDaysOf(plan),
      safety: ctx.safety,
      needsAcknowledgement:
        ctx.safety.requiresAcknowledgement && ctx.training.safetyAcknowledgedOn === undefined,
      disclaimer: TRAINING_DISCLAIMER,
    };
  };

  return {
    getTrainingProfile: () =>
      serial(async (): Promise<TrainingProfileResult> => {
        const profile = await ports.profiles.get();
        if (!profile) return NO_PROFILE;
        const training = await ports.training.getProfile();
        if (!training) {
          return {
            status: 'inactive',
            askPregnancyStage: asksPregnancyStage(profile),
            defaults: defaultTrainingInput(),
          };
        }
        return {
          status: 'active',
          ...profileView(profile, training),
        };
      }),

    saveTrainingProfile: (input) =>
      run('save', async (): Promise<SaveTrainingProfileResult> => {
        const profile = await ports.profiles.get();
        if (!profile) return NO_PROFILE;
        const issues = validateTrainingInput(input);
        if (issues.length > 0) return { status: 'invalid', issues };
        const training = buildTrainingProfile({
          answers: input,
          profile,
          existing: await ports.training.getProfile(),
          today: ports.clock.today(),
        });
        await ports.training.saveProfile(training);
        return {
          status: 'saved',
          ...profileView(profile, training),
        };
      }),

    acknowledgeTrainingSafety: () =>
      run('save', async (): Promise<TrainingProfileResult> => {
        const profile = await ports.profiles.get();
        if (!profile) return NO_PROFILE;
        const stored = await ports.training.getProfile();
        if (!stored) {
          return {
            status: 'inactive',
            askPregnancyStage: asksPregnancyStage(profile),
            defaults: defaultTrainingInput(),
          };
        }
        const training: TrainingProfile = {
          ...stored,
          safetyAcknowledgedOn: ports.clock.today(),
        };
        await ports.training.saveProfile(training);
        return {
          status: 'active',
          ...profileView(profile, training),
        };
      }),

    getTrainingWeek: () =>
      run('load', async (): Promise<TrainingWeekResult> => {
        const loaded = await loadContext(ports);
        if (loaded.status !== 'ready') return loaded;
        const { plan, origin } = await ensureWeek(ports, loaded.ctx);
        return weekView(loaded.ctx, plan, origin);
      }),

    async getTrainingDays() {
      const week = await serial(async () => {
        try {
          const loaded = await loadContext(ports);
          if (loaded.status !== 'ready') return undefined;
          return (await ensureWeek(ports, loaded.ctx)).plan;
        } catch {
          // Le lien avec la Nourriture est facultatif : sans Sport, rien ne change.
          return undefined;
        }
      });
      return week ? trainingDaysOf(week) : undefined;
    },

    getTrainingSession: (input) =>
      run('load', async (): Promise<TrainingSessionResult> => {
        const opened = await open(input);
        if (opened.status !== 'ready') return opened;
        return sessionView(opened.ctx, opened.plan, opened.session, opened.log);
      }),

    startSession: (input) =>
      run('save', async (): Promise<ActiveSessionResult> => {
        const opened = await open(input);
        if (opened.status !== 'ready') return opened;
        if (opened.log) return active(opened, opened.log);
        const log = startSessionLog(
          opened.session,
          opened.plan.weekStart,
          ports.clock.today(),
          ports.clock.now().toISOString(),
        );
        await ports.sessionLogs.save(log);
        return active(opened, log);
      }),

    logSet: ({ set, slotId, ...ref }) =>
      run('save', async (): Promise<ActiveSessionResult> => {
        const opened = await openStarted(ref);
        if (opened.status !== 'ready') return opened;
        if (!hasSlot(opened.log, slotId)) return unavailable(TRAINING_MESSAGES.unavailableExercise);
        const clean = sanitizeSet(set);
        if (!clean) return unavailable(TRAINING_MESSAGES.invalidSet);
        const log = logSetInSession(opened.log, slotId, clean);
        await ports.sessionLogs.save(log);
        return active(opened, log);
      }),

    markExerciseDone: ({ slotId, ...ref }) =>
      run('save', async (): Promise<ActiveSessionResult> => {
        const opened = await openStarted(ref);
        if (opened.status !== 'ready') return opened;
        if (!hasSlot(opened.log, slotId)) return unavailable(TRAINING_MESSAGES.unavailableExercise);
        const log = markExerciseDoneInSession(opened.log, slotId);
        await ports.sessionLogs.save(log);
        return active(opened, log);
      }),

    getExerciseAlternatives: ({ slotId, ...ref }) =>
      run('load', async (): Promise<ExerciseAlternativesResult> => {
        const opened = await openStarted(ref);
        if (opened.status !== 'ready') return opened;
        const avoided = avoidedExerciseIds(await ports.painReports.list(), ports.clock.today());
        const found = alternativesFor(opened, slotId, 'choix', avoided);
        if (!found) return unavailable(TRAINING_MESSAGES.unavailableExercise);
        return { status: 'ready', alternatives: found.alternatives };
      }),

    replaceExercise: ({ slotId, exerciseId, ...ref }) =>
      run('save', async (): Promise<ActiveSessionResult> => {
        const opened = await openStarted(ref);
        if (opened.status !== 'ready') return opened;
        const avoided = avoidedExerciseIds(await ports.painReports.list(), ports.clock.today());
        const found = alternativesFor(opened, slotId, 'choix', avoided);
        if (!found) return unavailable(TRAINING_MESSAGES.unavailableExercise);
        const choice = found.alternatives.find((exercise) => exercise.id === exerciseId);
        // On ne place jamais un exercice qui ne fait pas partie des remplaçants adaptés.
        if (!choice) return unavailable(TRAINING_MESSAGES.noReplacement);
        return active(opened, await swapExercise(opened, slotId, choice));
      }),

    reportPain: ({ slotId, ...ref }) =>
      run('save', async (): Promise<PainResult> => {
        const opened = await openStarted(ref);
        if (opened.status !== 'ready') return opened;
        const today = ports.clock.today();
        const planned = opened.log.exercises.find((e) => e.slotId === slotId);
        const painful = opened.ctx.byId.get(planned?.exerciseId ?? '');
        if (!planned || !painful) return unavailable(TRAINING_MESSAGES.unavailableExercise);
        // Le signalement d'abord : la prudence ne dépend pas du remplacement.
        await ports.painReports.save({
          id: `${today}:${painful.id}`,
          date: today,
          exerciseId: painful.id,
          muscles:
            painful.primaryMuscles.length > 0 ? painful.primaryMuscles : painful.secondaryMuscles,
        });
        const reports = await ports.painReports.list();
        const found = alternativesFor(
          opened,
          slotId,
          'douleur',
          avoidedExerciseIds(reports, today),
        );
        const replacement = found?.alternatives[0];
        const log = replacement ? await swapExercise(opened, slotId, replacement) : opened.log;
        return {
          status: 'reported',
          messages: painMessages(reports, today),
          avoidedUntil: painAvoidanceEnd(today),
          ...(replacement ? { replacement } : {}),
          session: active(opened, log),
        };
      }),

    completeSession: ({ effort, ...ref }) =>
      run('save', async (): Promise<CompleteSessionResult> => {
        const opened = await openStarted(ref);
        if (opened.status !== 'ready') return opened;
        const { log, session } = opened;
        const before = completedSessionCount(await ports.sessionLogs.listAll());
        let finished = log;
        if (log.status !== 'terminee') {
          const someDone = log.exercises.some(
            (exercise) => exercise.done || exercise.sets.some((set) => set.done),
          );
          if (!someDone) return { status: 'nothing-done', message: TRAINING_MESSAGES.nothingDone };
          finished = finishSessionLog(
            log,
            ports.clock.now().toISOString(),
            effort !== undefined && EFFORT_SET.includes(effort) ? effort : undefined,
          );
          await ports.sessionLogs.save(finished);
          // Une séance terminée est un geste de la série (au mieux, sous le même verrou).
          if (isSessionComplete(session, finished)) await recordCompanionActivity(ports);
        }
        const after = completedSessionCount(await ports.sessionLogs.listAll());
        return {
          status: 'completed',
          session: active(opened, finished),
          sessionsCompleted: after,
          newAccessories: newSportAccessories(before, after),
        };
      }),

    async getExerciseSheet(exerciseId) {
      try {
        const [exercises, media] = await Promise.all([
          ports.exercises.getExercises(),
          ports.exercises.getMedia(exerciseId),
        ]);
        const exercise = exercises.find((e) => e.id === exerciseId);
        return exercise ? { exercise, media, disclaimer: TRAINING_DISCLAIMER } : undefined;
      } catch {
        return undefined;
      }
    },

    async listExerciseCredits() {
      let exercises: readonly Exercise[] = [];
      try {
        exercises = await ports.exercises.getExercises();
      } catch {
        // Écran sans fiches plutôt qu'une erreur : le texte de licence reste lisible.
      }
      const medias = await Promise.all(
        exercises.map(async (exercise) => {
          try {
            return { exercise, media: await ports.exercises.getMedia(exercise.id) };
          } catch {
            return { exercise, media: undefined };
          }
        }),
      );
      return {
        texts: EXERCISE_CREDITS_TEXTS,
        exerciseCount: exercises.length,
        credit: medias.find((entry) => entry.media !== undefined)?.media?.credit,
        videos: medias.flatMap(({ exercise, media }) =>
          (media?.videos ?? []).map((video) => ({
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            video,
          })),
        ),
      };
    },

    async getTrainingHistory() {
      const [logs, plans] = await Promise.all([
        ports.sessionLogs.listAll(),
        ports.training.listPlans(),
      ]);
      return {
        entries: sessionHistory(logs, plans),
        sessionsCompleted: completedSessionCount(logs),
      };
    },

    async getActivitySuggestion() {
      return serial(() => currentSuggestion(ports));
    },

    acceptActivitySuggestion: () =>
      serial(async (): Promise<ActivitySuggestionResult> => {
        const suggestion = await currentSuggestion(ports);
        const profile = await ports.profiles.get();
        if (!suggestion || !profile) return { status: 'none' };
        await ports.profiles.save({ ...profile, activity: suggestion.suggested });
        // Un cran à la fois : la suivante, s'il y en a une, ne vient pas avant 28 jours.
        const settings = await ports.settings.get();
        await ports.settings.save({
          ...settings,
          activitySuggestionDismissedOn: ports.clock.today(),
        });
        return { status: 'updated', level: suggestion.suggested };
      }),

    dismissActivitySuggestion: () =>
      serial(async () => {
        const settings = await ports.settings.get();
        await ports.settings.save({
          ...settings,
          activitySuggestionDismissedOn: ports.clock.today(),
        });
      }),

    async getSportRewards() {
      const count = completedSessionCount(await ports.sessionLogs.listAll());
      return {
        sessionsCompleted: count,
        unlocked: unlockedSportAccessories(count),
        next: nextSportAccessory(count),
      };
    },

    async keepScreenOn() {
      try {
        return await ports.wakeLock.acquire();
      } catch {
        return false;
      }
    },

    async releaseScreen() {
      try {
        await ports.wakeLock.release();
      } catch {
        // Rien à relâcher : repli silencieux.
      }
    },
  };
}
