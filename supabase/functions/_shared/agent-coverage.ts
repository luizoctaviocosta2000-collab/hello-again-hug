/** Exact count is essential: an API cap can be smaller than our requested limit. */
export function isIncompleteAgentDataset(count: number | null, returned: number): boolean {
  return count === null || !Number.isSafeInteger(count) || count < 0 || count !== returned;
}
