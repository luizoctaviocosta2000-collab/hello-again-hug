export type ImobfyUser = {
  id: string;
  name: string;
  email: string;
  creci?: string;
};

const SESSION_KEY = "imobfy:session";

export function getSession(): ImobfyUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as ImobfyUser) : null;
  } catch {
    return null;
  }
}

export function setSession(user: ImobfyUser) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

export function clearDemoData() {
  if (typeof window === "undefined") return;
  ["imoveis", "clientes", "negocios", "agenda", "comissoes", "vgv", "configuracoes"].forEach((module) => {
    window.localStorage.removeItem(`imobfy:${module}`);
  });
}
