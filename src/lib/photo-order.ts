type Photo = { id: string; category: string };
type Classification = { index: number; category: string; order: number };

// A request classifies a snapshot. Preserve photos added, removed or replaced
// while it was in flight instead of applying old indices to the current list.
export function mergePhotoClassification<T extends Photo>(
  current: readonly T[],
  submitted: readonly T[],
  classification: readonly Classification[],
): T[] {
  const available = new Map(current.map(photo => [photo.id, photo]));
  const included = new Set<string>();
  const ordered: T[] = [];
  for (const item of classification) {
    const original = submitted[item.index];
    const photo = original && available.get(original.id);
    if (!photo || included.has(photo.id)) continue;
    ordered.push({ ...photo, category: item.category });
    included.add(photo.id);
  }
  return [...ordered, ...current.filter(photo => !included.has(photo.id))];
}
