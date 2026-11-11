import type { Pace } from "@/lib/trial/types";

/** Thrown inside the run loop when the person watching ends the trial. */
export class StopSignal extends Error {
  constructor() {
    super("Trial stopped");
    this.name = "StopSignal";
  }
}

const SPEED: Record<Pace, number> = { normal: 1, fast: 12 };

/**
 * The trial's clock. Everything the engine waits for goes through here, so a
 * trial can be paused, sped up or stopped at any moment.
 */
export class Clock {
  paused = false;
  stopped = false;
  speed: number;

  constructor(pace: Pace) {
    this.speed = SPEED[pace];
  }

  stop(): void {
    this.stopped = true;
  }

  private check(): void {
    if (this.stopped) throw new StopSignal();
  }

  /** Waits for a length of trial time. Pausing stops the count. */
  async sleep(ms: number): Promise<void> {
    let remaining = ms / this.speed;
    let last = performance.now();
    while (remaining > 0) {
      this.check();
      await new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 50)));
      const now = performance.now();
      if (!this.paused) remaining -= now - last;
      last = now;
    }
    this.check();
  }

  /** Waits until `probe` returns something, in real time. Returns null on timeout. */
  async waitFor<T>(
    probe: () => T | null | undefined | false,
    timeoutMs: number,
  ): Promise<T | null> {
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      this.check();
      const value = probe();
      if (value) return value;
      if (performance.now() > deadline) return null;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /** Resolves once the trial is not paused. */
  async whenRunning(): Promise<void> {
    while (this.paused) {
      this.check();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.check();
  }
}
