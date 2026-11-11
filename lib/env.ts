import { z } from "zod";

/**
 * Server-side environment. Parsed lazily so that builds and unit tests do not
 * need secrets, and so that a missing value fails with a clear message at the
 * point of use.
 */

const serverEnvSchema = z.object({
  BRAINTREE_MERCHANT_ID: z.string().min(1),
  BRAINTREE_PUBLIC_KEY: z.string().min(1),
  BRAINTREE_PRIVATE_KEY: z.string().min(1),
  /** Optional. If present it must say "sandbox". See lib/guards/sandbox.ts. */
  PAYMENTS_ENVIRONMENT: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

type EnvSource = Record<string, string | undefined>;

export function parseServerEnv(source: EnvSource): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${missing}. See .env.example.`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/**
 * Collects AI keys from either a comma-separated GEMINI_API_KEYS value or
 * numbered GEMINI_API_KEY_1, GEMINI_API_KEY_2, ... variables. Order is stable
 * and duplicates are removed. An empty list is valid: the app then runs with
 * its built-in explanations and says so.
 */
export function collectAiKeys(source: EnvSource): string[] {
  const keys: string[] = [];
  for (const part of (source.GEMINI_API_KEYS ?? "").split(",")) {
    if (part.trim()) keys.push(part.trim());
  }
  const numbered = Object.keys(source)
    .map((name) => /^GEMINI_API_KEY_(\d+)$/.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .sort((a, b) => Number(a[1]) - Number(b[1]));
  for (const match of numbered) {
    const value = source[match[0]]?.trim();
    if (value) keys.push(value);
  }
  return [...new Set(keys)];
}
