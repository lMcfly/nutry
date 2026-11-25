/**
 * Recherche par dichotomie de la valeur d'un paramètre qui amène une mesure (monotone) à sa
 * cible : sert à caler une pose sur ses appuis (épaules à la bonne hauteur, pointe au sol…).
 */
export function tune(
  measure: (v: number) => number,
  target: number,
  lo: number,
  hi: number,
): number {
  let a = lo;
  let b = hi;
  const rising = measure(b) > measure(a);
  for (let i = 0; i < 40; i += 1) {
    const mid = (a + b) / 2;
    const above = measure(mid) > target;
    if (above === rising) b = mid;
    else a = mid;
  }
  return (a + b) / 2;
}
