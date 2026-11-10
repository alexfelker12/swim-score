/** "1 Spiel", "0 Spiele", "37 Spiele". */
export function gameCount(count: number): string {
  return count === 1 ? "1 Spiel" : `${count} Spiele`
}
