/**
 * Sound effects made in the browser from simple tones. No audio files, so
 * there is nothing to license. Sound stays off until the person watching
 * turns it on, as browsers require.
 */

type Note = { frequency: number; at: number; length: number; type?: OscillatorType };

const SOUNDS: Record<string, Note[]> = {
  pass: [
    { frequency: 660, at: 0, length: 0.08 },
    { frequency: 880, at: 0.08, length: 0.14 },
  ],
  // A coin dropping and bouncing away.
  snag: [
    { frequency: 1320, at: 0, length: 0.05, type: "square" },
    { frequency: 990, at: 0.07, length: 0.05, type: "square" },
    { frequency: 660, at: 0.14, length: 0.09, type: "square" },
  ],
  step: [{ frequency: 180, at: 0, length: 0.03, type: "triangle" }],
  abandon: [
    { frequency: 392, at: 0, length: 0.2, type: "triangle" },
    { frequency: 330, at: 0.2, length: 0.2, type: "triangle" },
    { frequency: 262, at: 0.4, length: 0.4, type: "triangle" },
  ],
  purchase: [
    { frequency: 523, at: 0, length: 0.1 },
    { frequency: 659, at: 0.1, length: 0.1 },
    { frequency: 784, at: 0.2, length: 0.1 },
    { frequency: 1047, at: 0.3, length: 0.3 },
  ],
};

export type SoundName = keyof typeof SOUNDS;

export class Sfx {
  private context: AudioContext | null = null;
  enabled = false;

  /**
   * Turns sound on. Browsers only let a page play sound once the person has
   * clicked or pressed a key on it, so if sound is held back now it starts at
   * the first click or key press on the page.
   */
  enable(): void {
    try {
      this.context ??= new AudioContext();
    } catch {
      return;
    }
    this.enabled = true;
    const context = this.context;
    void context.resume().catch(() => undefined);
    if (context.state === "running") return;
    const unlock = () => {
      void context.resume().catch(() => undefined);
      if (context.state === "running") {
        window.removeEventListener("pointerdown", unlock, true);
        window.removeEventListener("keydown", unlock, true);
      }
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
  }

  disable(): void {
    this.enabled = false;
  }

  play(name: SoundName): void {
    const context = this.context;
    if (!this.enabled || !context || context.state !== "running") return;
    const start = context.currentTime;
    for (const note of SOUNDS[name]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = note.type ?? "sine";
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0.0001, start + note.at);
      gain.gain.exponentialRampToValueAtTime(0.12, start + note.at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.length);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + note.at);
      oscillator.stop(start + note.at + note.length + 0.02);
    }
  }

  destroy(): void {
    void this.context?.close();
    this.context = null;
  }
}
