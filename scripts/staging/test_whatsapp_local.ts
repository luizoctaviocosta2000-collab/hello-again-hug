/**
 * Disposable embedded PostgreSQL test. Requires a separately installed PGlite
 * entry path in IMOBFY_PGLITE_MODULE; no connection to hosted Supabase.
 * This is NOT native PostgreSQL 17, Auth HTTP, or a concurrency test.
 */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const modulePath = process.env.IMOBFY_PGLITE_MODULE;
if (!modulePath) throw new Error("Set IMOBFY_PGLITE_MODULE to the PGlite dist/index.js path.");
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
try {
  await db.exec(await readFile("tests/database/agent_autonomy_fixture.sql", "utf8"));
  await db.exec(`
    create table public.clients(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), name text not null, phone text);
    create table public.properties(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id));
    create table public.deals(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id));
  `);
  for (const file of [
    "supabase/migrations/20261118100000_intelligence_foundation.sql",
    "supabase/migrations/20261119100000_whatsapp_ingress.sql",
    "tests/database/whatsapp_ingress_regression.sql",
  ]) {
    await db.exec(await readFile(file, "utf8"));
    console.log("PASS", file);
  }
  console.log(await db.query("select version()"));
} finally {
  await db.close();
}
