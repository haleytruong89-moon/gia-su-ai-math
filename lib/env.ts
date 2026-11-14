// lib/env.ts
import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});
const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  TUTOR_MODEL_MAIN: z.string().default("claude-sonnet-5-5"),
  TUTOR_MODEL_LIGHT: z.string().default("claude-haiku-5-5"),
  // Required from G4 (cas) and G7 (notify, cron); G1 runs without them.
  CAS_URL: z.string().url().optional(),
  CAS_SECRET: z.string().min(1).optional(),
  LAUNCHER_URL: z.string().url().optional(),
  TUTOR_NOTIFY_SECRET: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
});
export type ServerEnv = z.infer<typeof serverSchema>;

export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  const r = serverSchema.safeParse(raw);
  if (!r.success) throw new Error(`Bad env: ${r.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  return r.data;
}
export const publicEnv = () => publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
export const serverEnv = () => parseServerEnv(process.env);
