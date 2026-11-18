import { supabase } from "./supabase";
import { verifiedUserFromAuthResult } from "./verified-auth-user";

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

  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        window.setTimeout(() => reject(new Error("TIMEOUT")), 8000),
      ),
    ]);

    // A cached localStorage profile is never sufficient to grant UI access.
    // Only a positively verified Supabase Auth identity opens private routes.
    const verifiedUser = verifiedUserFromAuthResult(result);
    if (verifiedUser) {
      setSession(verifiedUser);
      return verifiedUser;
    }

    // Preserve cached display preferences on transient network errors, but
    // ALWAYS deny access until Auth can positively verify the session.
    const authError = result.error as { status?: number; name?: string; message?: string } | null;
    const message = authError?.message || "";
    const definitivelyInvalid =
      authError?.status === 401 ||
      authError?.name === "AuthSessionMissingError" ||
      /session (is )?(missing|invalid|expired)|jwt expired/i.test(message);
    if (!result.error || definitivelyInvalid) clearSession();
    return null;
  } catch {
    // Includes timeout/offline: fail closed rather than trusting localStorage.
    return null;
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
