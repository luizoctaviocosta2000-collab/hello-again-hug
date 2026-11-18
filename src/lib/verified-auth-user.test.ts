import { describe, expect, test } from "bun:test";
import { verifiedUserFromAuthResult } from "./verified-auth-user";

describe("verified Supabase Auth identity", () => {
  test("denies a missing or expired Auth session", () => {
    expect(verifiedUserFromAuthResult({ data: { user: null }, error: null })).toBeNull();
    expect(verifiedUserFromAuthResult({ data: null, error: { name: "AuthSessionMissingError" } })).toBeNull();
    expect(verifiedUserFromAuthResult({ data: { user: { id: "cached" } }, error: { status: 401 } })).toBeNull();
    expect(verifiedUserFromAuthResult({ data: { user: { id: "" } }, error: null })).toBeNull();
  });

  test("accepts only the positively verified user's identity", () => {
    expect(verifiedUserFromAuthResult({
      data: {
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          email: "broker@example.invalid",
          user_metadata: { full_name: "Corretor Teste" },
        },
      },
      error: null,
    })).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Corretor Teste",
      email: "broker@example.invalid",
    });
  });

  test("falls back to an email-derived display name, not a cached user", () => {
    expect(verifiedUserFromAuthResult({
      data: { user: { id: "auth-id", email: "corretora@example.invalid", user_metadata: { full_name: 123 } } },
      error: null,
    })).toEqual({ id: "auth-id", name: "corretora", email: "corretora@example.invalid" });
  });
});
