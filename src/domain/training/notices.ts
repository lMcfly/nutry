import type { TrainingNoticeCode } from './training.types';

/** Avis du planificateur (ADR 0010 : textes liés à une règle, au tutoiement, sans culpabiliser). */
export const TRAINING_NOTICES: Readonly<Record<TrainingNoticeCode, string>> = {
  'jours-rapproches':
    'Tes jours de séance sont proches : certaines séances sont plus douces pour laisser reposer tes muscles. Espace-les d’au moins deux jours si tu veux un programme complet.',
  'seances-plafonnees':
    'Pour ta sécurité, le nombre de séances de renforcement est limité : les autres jours sont des séances douces.',
  'catalogue-insuffisant':
    'Il manque quelques exercices adaptés à ton matériel et à ta situation : certaines séances sont un peu plus courtes.',
  'semaine-allegee':
    'Semaine allégée : moins de séries et des charges un peu plus légères pour bien récupérer avant de repartir.',
  reprise: 'Content de te revoir ! Cette semaine, on reprend en douceur.',
};
