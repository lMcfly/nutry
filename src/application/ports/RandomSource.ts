/** Source d'aléa injectable (tests déterministes avec une graine). */
export interface RandomSource {
  /** Nombre dans l'intervalle [0, 1). */
  next(): number;
}
