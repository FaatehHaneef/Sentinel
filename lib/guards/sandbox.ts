/**
 * Sentinel only ever moves test money. The payments environment is fixed to
 * the sandbox in code. There is deliberately no setting that switches it to a
 * live environment: PAYMENTS_ENVIRONMENT exists only so that a deployment
 * misconfigured for live use refuses to run instead of silently continuing.
 */

export const PAYMENTS_ENVIRONMENT = "sandbox" as const;

export class LiveEnvironmentError extends Error {
  constructor(found: string) {
    super(
      `Sentinel runs against the payments sandbox only, but PAYMENTS_ENVIRONMENT is "${found}". ` +
        `Remove it or set it to "sandbox".`,
    );
    this.name = "LiveEnvironmentError";
  }
}

export function assertSandboxOnly(source: Record<string, string | undefined>): void {
  const declared = source.PAYMENTS_ENVIRONMENT?.trim().toLowerCase();
  if (declared !== undefined && declared !== "" && declared !== PAYMENTS_ENVIRONMENT) {
    throw new LiveEnvironmentError(declared);
  }
}
