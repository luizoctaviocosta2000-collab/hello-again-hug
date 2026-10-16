import { supabase } from "./supabase";

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

export async function restoreSession(): Promise<ImobfyUser | null> {
  if (typeof window === "undefined") return null;
  const localSession = getSession();
  if (!supabase) return localSession;

  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error("TIMEOUT")), 8000),
      ),
    ]);

    if (result.error) {
      const authError = result.error as { status?: number; name?: string; message?: string };
      const message = authError.message || "";
      const invalidSession =
        authError.status === 401 ||
        authError.name === "AuthSessionMissingError" ||
        /session (is )?(missing|invalid|expired)|jwt expired/i.test(message);

      if (invalidSession) {
        clearSession();
        return null;
      }

      // A temporary API/network error must not erase a valid cached session.
      return localSession;
    }

    const { data } = result;
    if (!data.user) {
      clearSession();
      return null;
    }

    const user: ImobfyUser = {
      id: data.user.id,
      name: (data.user.user_metadata?.full_name as string | undefined) || data.user.email?.split("@")[0] || "Corretor",
      email: data.user.email || "",
    };
    setSession(user);
    return user;
  } catch {
    // Timeouts and transport failures are not proof that the session is invalid.
    return localSession;
  }
}

export function setSession(user: ImobfyUser) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
  clearSession();
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
