export const IMOBFY_STORAGE_KEYS = {
  clients: "imobfy-clients-v1",
  agenda: "imobfy-agenda-v1",
} as const;

export function loadImobfyList<T>(key: string, fallback: T[] = []): T[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveImobfyList<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function appendImobfyItem<T extends { id: string }>(key: string, item: T) {
  const current = loadImobfyList<T>(key);
  saveImobfyList(key, [...current, item]);
  return item;
}

export function removeImobfyItem(key: string, id: string) {
  const current = loadImobfyList<{ id: string }>(key);
  saveImobfyList(key, current.filter(item => item.id !== id));
}
