// @ts-nocheck — demo only; packages are not installed in this extension repo.
// Try Dev-Log: open this file → Command Palette → "Dev-Log: Generate Case Study from Active File"
// → writes devlog_entry.md at workspace root (imports → trade-offs + Mermaid sequence).

import { createClient } from "@supabase/supabase-js";
import { compare } from "bcrypt";
import { z } from "zod";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/**
 * Minimal email/password login: validate input, load user hash from Postgres (via Supabase),
 * verify with bcrypt, then record a session row.
 */
export async function loginWithEmail(
  raw: unknown,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "invalid_input" };
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: row, error } = await supabase
    .from("users")
    .select("id, password_hash")
    .eq("email", parsed.data.email)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: "auth_failed" };
  }

  const match = await compare(parsed.data.password, row.password_hash);
  if (!match) {
    return { ok: false, error: "auth_failed" };
  }

  await supabase.from("sessions").insert({ user_id: row.id });
  return { ok: true, sessionId: "sess_demo" };
}
