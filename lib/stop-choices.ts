// Stop pickers that belong together (a ride's pickup and drop spots, search's From and To, a
// member's home and office) never offer a stop already picked in another one: the lists stay
// short, and nobody picks the same place twice. Each picker keeps its own pick.

export function placesLeft<T extends { id: string }>(
  places: readonly T[],
  takenElsewhere: Iterable<string>,
): T[] {
  const taken = new Set([...takenElsewhere].filter(Boolean));
  return places.filter((p) => !taken.has(p.id));
}

// For the n-th of several pickers: what the others have picked. Never its own pick, even when
// an old save picked one stop twice, so no picker loses the stop it shows.
export function pickedByOthers(picks: readonly string[], n: number): string[] {
  return picks.filter((id, i) => i !== n && id !== "" && id !== picks[n]);
}
