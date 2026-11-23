import { createCatalogUseCases } from './catalog';
import type { CatalogUseCases } from './catalog';
import { createSerialRunner, memoryDeviceStorage } from './context';
import type { AppPorts } from './context';
import { createDataUseCases } from './data';
import type { DataUseCases } from './data';
import { createFridgeUseCases } from './fridge';
import type { FridgeUseCases } from './fridge';
import { createPlanUseCases } from './plan';
import type { PlanUseCases } from './plan';
import { createProfileUseCases } from './profile';
import type { ProfileUseCases } from './profile';
import { createProgressUseCases } from './progress';
import type { ProgressUseCases } from './progress';
import { createQuizUseCases } from './quiz';
import type { QuizUseCases } from './quiz';
import { createRatingUseCases } from './ratings';
import type { RatingUseCases } from './ratings';
import { createSettingsUseCases } from './settings';
import type { SettingsUseCases } from './settings';
import { createShoppingUseCases } from './shopping';
import type { ShoppingUseCases } from './shopping';

/** Tous les cas d'usage, seule API de l'application exposée à la présentation. */
export type UseCases = ProfileUseCases &
  PlanUseCases &
  RatingUseCases &
  ShoppingUseCases &
  FridgeUseCases &
  QuizUseCases &
  ProgressUseCases &
  SettingsUseCases &
  DataUseCases &
  CatalogUseCases;

/**
 * Fabrique les cas d'usage à partir des ports (injection par paramètres, sans framework).
 * Les écritures sont sérialisées par un verrou commun.
 */
export function createUseCases(appPorts: AppPorts): UseCases {
  const serial = createSerialRunner();
  const ports = { ...appPorts, device: appPorts.device ?? memoryDeviceStorage() };
  return {
    ...createProfileUseCases(ports, serial),
    ...createPlanUseCases(ports, serial),
    ...createRatingUseCases(ports, serial),
    ...createShoppingUseCases(ports, serial),
    ...createFridgeUseCases(ports),
    ...createQuizUseCases(ports, serial),
    ...createProgressUseCases(ports, serial),
    ...createSettingsUseCases(ports, serial),
    ...createDataUseCases(ports, serial),
    ...createCatalogUseCases(ports),
  };
}

export type { AppPorts, NoProfile } from './context';
export type {
  BackupReminder,
  ExportResult,
  ImportCounts,
  ImportFailure,
  ImportResult,
  WipeResult,
} from './data';
export {
  IMPORT_MAX_LENGTH,
  IMPORT_MESSAGES,
  PASSPHRASE_MIN_LENGTH,
  STORAGE_FAILURE_MESSAGES,
} from './data';
export type { FridgeResult } from './fridge';
export type {
  MealAlternative,
  PlanHistory,
  PlanOrigin,
  PlanResult,
  PlanView,
  RecipeIngredientLine,
  RecipeView,
} from './plan';
export type {
  EnergyDetail,
  HealthSummary,
  ProfilePreview,
  ProfileView,
  SaveProfileResult,
} from './profile';
export type { LogProgressInput, ProgressView, WeightTrackingStatus } from './progress';
export { WEIGHT_TRACKING_DISABLED_MESSAGE } from './progress';
export type { DailyQuizView, QuizAnswerView } from './quiz';
export type { RateMealInput } from './ratings';
export type { ShoppingResult, ShoppingView } from './shopping';
export type { ShareResult } from '../ports';
export { MANUAL_ITEM_MAX_LENGTH } from './shopping';
