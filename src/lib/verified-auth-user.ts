import type { ImobfyUser } from "./imobfy-session";

/**
 * Maps ONLY a user verified by Supabase Auth to the local UI model.
 * Cached profile data and an Auth error are never proof of authentication.
 */
type AuthSnapshot = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type AuthResult = {
  data?: { user?: AuthSnapshot | null } | null;
  error?: unknown;
};

export function verifiedUserFromAuthResult(result: AuthResult): ImobfyUser | null {
  if (result.error || !result.data?.user) return null;
  const user = result.data.user;
  if (typeof user.id !== "string" || !user.id.trim()) return null;

  const fullName = user.user_metadata?.full_name;
  const email = typeof user.email === "string" ? user.email : "";

  return {
    id: user.id,
    name:
      (typeof fullName === "string" && fullName.trim()) ||
      email.split("@")[0] ||
      "Corretor",
    email,
  };
}
