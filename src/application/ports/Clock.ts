/** Source du temps : injectée pour des tests déterministes (date du jour, saison). */
export interface Clock {
  now(): Date;
}
