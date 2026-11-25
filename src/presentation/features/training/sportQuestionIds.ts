export type SportQuestionId =
  'frequency' | 'days' | 'setting' | 'level' | 'goal' | 'duration' | 'pregnancyStage';

/** Questions de l'onboarding Sport, dans l'ordre ; l'étape de grossesse seulement si elle est posée. */
export function sportQuestionIds(askPregnancyStage: boolean): SportQuestionId[] {
  return [
    'frequency',
    'days',
    'setting',
    'level',
    'goal',
    'duration',
    ...(askPregnancyStage ? (['pregnancyStage'] as const) : []),
  ];
}
