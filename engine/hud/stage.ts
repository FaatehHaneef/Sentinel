import type { SpriteSheet } from "../art/sprite";
import type { Clock } from "../core/clock";

/** Every character supplies frames named idle, walk1, walk2, worry, fuss and happy. */
export type Animation = "idle" | "walk" | "worry" | "fuss" | "shake" | "happy";

const SEQUENCES: Record<Animation, { frames: string[]; perSecond: number }> = {
  idle: { frames: ["idle"], perSecond: 1 },
  walk: { frames: ["walk1", "idle", "walk2", "idle"], perSecond: 8 },
  worry: { frames: ["worry"], perSecond: 1 },
  fuss: { frames: ["fuss", "fuss", "idle"], perSecond: 3 },
  // Trembling: the two reaction frames in quick alternation.
  shake: { frames: ["worry", "fuss"], perSecond: 10 },
  happy: { frames: ["happy"], perSecond: 1 },
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  colour: string;
  size: number;
  gravity: number;
};

/** A faint figure standing where the character struggled in the previous trial. */
type Ghost = { element: Element; alpha: number; fading: boolean };

const GHOST_ALPHA = 0.38;

const WALK_SPEED = 300; // CSS pixels per second of trial time
export const SPRITE_SCALE = 3;

/**
 * The layer the character lives on: a transparent canvas over the whole page.
 * The character walks in viewport coordinates, towards whichever real element
 * the engine points it at.
 */
export class Stage {
  private readonly context: CanvasRenderingContext2D;
  private sprite: SpriteSheet | null = null;
  private x = -80;
  private y = 200;
  private targetX = -80;
  private targetY = 200;
  private facing: 1 | -1 = 1;
  private animation: Animation = "idle";
  private animationClock = 0;
  private particles: Particle[] = [];
  private ghost: Ghost | null = null;
  private ghostCanvas: HTMLCanvasElement | null = null;
  private spotFor: ((element: Element) => { x: number; y: number }) | null = null;
  private arrived: (() => void) | null = null;
  private last = performance.now();
  private frame = 0;
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly portrait: HTMLCanvasElement,
    private readonly clock: Clock,
  ) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    this.context = context;
    this.resize();
    window.addEventListener("resize", this.resize);
    this.frame = requestAnimationFrame(this.tick);
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    window.removeEventListener("resize", this.resize);
  }

  setSprite(sprite: SpriteSheet): void {
    this.sprite = sprite;
  }

  setAnimation(animation: Animation): void {
    if (this.animation !== animation) {
      this.animation = animation;
      this.animationClock = 0;
    }
  }

  /** Tells the stage where a character stands for a given element. */
  setSpotResolver(resolver: (element: Element) => { x: number; y: number }): void {
    this.spotFor = resolver;
  }

  /**
   * On a re-run, shows where the character struggled last time: one faint,
   * blue figure a step behind the spot being checked now, tagged "last time".
   * Only one is ever shown.
   */
  showGhost(element: Element | null): void {
    this.ghost = element ? { element, alpha: GHOST_ALPHA, fading: false } : null;
  }

  /** Lets the ghost at an element fade away. */
  releaseGhost(element: Element): void {
    if (this.ghost?.element === element) this.ghost.fading = true;
  }

  /** The character's worried frame, tinted ghostly blue. */
  private ghostImage(frame: HTMLCanvasElement): HTMLCanvasElement {
    const canvas = (this.ghostCanvas ??= document.createElement("canvas"));
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext("2d");
    if (!context) return frame;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(frame, 0, 0);
    context.globalCompositeOperation = "source-atop";
    context.fillStyle = "rgba(143, 200, 255, 0.75)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "source-over";
    return canvas;
  }

  /** Puts the character just off the left edge, ready to walk in. */
  enterFromLeft(y: number): void {
    this.x = this.targetX = -60;
    this.y = this.targetY = y;
  }

  /** Where the character's feet are, in viewport coordinates. */
  get feet(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /** Walks until the character's feet reach the point. */
  walkTo(x: number, y: number): Promise<void> {
    this.arrived?.();
    this.targetX = x;
    this.targetY = y;
    if (this.reducedMotion) {
      this.x = x;
      this.y = y;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.arrived = () => {
        this.arrived = null;
        resolve();
      };
    });
  }

  /** Coins fall out of the purse. */
  spillCoins(count: number): void {
    if (this.reducedMotion) return;
    const pieces = Math.min(24, Math.max(3, Math.round(count / 2)));
    for (let i = 0; i < pieces; i++) {
      this.particles.push({
        x: this.x,
        y: this.y - 40,
        vx: (Math.random() - 0.5) * 220,
        vy: -120 - Math.random() * 160,
        life: 1.1,
        colour: i % 3 === 0 ? "#ffe08a" : "#ffb347",
        size: 5,
        gravity: 620,
      });
    }
  }

  /** Marks where a run of shaky taps landed: green for a hit, red for a miss. */
  showTaps(points: { x: number; y: number; hit: boolean }[]): void {
    for (const point of points) {
      this.particles.push({
        x: point.x - 3,
        y: point.y - 3,
        vx: 0,
        vy: 0,
        life: 2.2,
        colour: point.hit ? "#6fae75" : "#e05a6d",
        size: 6,
        gravity: 0,
      });
    }
  }

  /** A small burst of light for something that went right. */
  sparkle(): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10;
      this.particles.push({
        x: this.x,
        y: this.y - 50,
        vx: Math.cos(angle) * 90,
        vy: Math.sin(angle) * 90,
        life: 0.6,
        colour: i % 2 ? "#fff6d6" : "#6fae75",
        size: 4,
        gravity: 0,
      });
    }
  }

  private resize = (): void => {
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(window.innerWidth * ratio);
    this.canvas.height = Math.round(window.innerHeight * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.context.imageSmoothingEnabled = false;
  };

  private tick = (now: number): void => {
    const elapsed = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const dt = this.clock.paused ? 0 : elapsed;
    this.update(dt);
    this.draw();
    this.frame = requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    // If the trial was ended, release anyone waiting for the character to arrive.
    if (this.clock.stopped) this.arrived?.();
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 1) {
      const step = Math.min(distance, WALK_SPEED * this.clock.speed * dt);
      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;
      if (Math.abs(dx) > 2) this.facing = dx > 0 ? 1 : -1;
      if (this.animation === "idle") this.setAnimation("walk");
    } else {
      if (this.animation === "walk") this.setAnimation("idle");
      this.arrived?.();
    }
    this.animationClock += dt;

    for (const particle of this.particles) {
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);

    if (this.ghost) {
      if (this.ghost.fading) this.ghost.alpha -= dt * 0.9;
      if (this.ghost.alpha <= 0 || !this.ghost.element.isConnected) this.ghost = null;
    }
  }

  private currentFrame(): HTMLCanvasElement | null {
    if (!this.sprite) return null;
    const sequence = SEQUENCES[this.animation];
    const index = Math.floor(this.animationClock * sequence.perSecond) % sequence.frames.length;
    return this.sprite.frames[sequence.frames[index]] ?? this.sprite.frames.idle;
  }

  private draw(): void {
    const { context } = this;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const frame = this.currentFrame();
    if (!frame || !this.sprite) return;

    const width = this.sprite.width * SPRITE_SCALE;
    const height = this.sprite.height * SPRITE_SCALE;
    const bob = this.animation === "walk" && Math.floor(this.animationClock * 8) % 2 ? -2 : 0;

    // The ghost of the last trial, drawn first and a step behind, so the character stands in front of it.
    if (this.ghost && this.spotFor) {
      const spot = this.spotFor(this.ghost.element);
      // On the far side of the spot, away from the card, so it is never hidden behind it.
      const x = Math.round(spot.x - width / 2 + 40);
      const y = Math.round(spot.y - height);
      context.globalAlpha = this.ghost.alpha;
      context.drawImage(this.ghostImage(this.sprite.frames.worry ?? frame), x, y, width, height);
      context.font = "bold 11px ui-monospace, Consolas, monospace";
      context.textAlign = "center";
      context.fillStyle = "rgba(18, 21, 42, 0.85)";
      context.fillRect(x + width / 2 - 34, y - 18, 68, 15);
      context.fillStyle = "#cfe8ff";
      context.fillText("last time", x + width / 2, y - 7);
      context.textAlign = "start";
      context.globalAlpha = 1;
    }

    // Soft shadow under the feet so the character reads against any page.
    context.fillStyle = "rgba(18, 21, 42, 0.28)";
    context.beginPath();
    context.ellipse(this.x, this.y + 2, width * 0.42, 5, 0, 0, Math.PI * 2);
    context.fill();

    context.save();
    context.translate(Math.round(this.x), Math.round(this.y + bob));
    context.scale(this.facing, 1);
    context.drawImage(frame, -width / 2, -height, width, height);
    context.restore();

    for (const particle of this.particles) {
      context.globalAlpha = Math.min(1, particle.life * 2);
      context.fillStyle = particle.colour;
      context.fillRect(
        Math.round(particle.x),
        Math.round(particle.y),
        particle.size,
        particle.size,
      );
    }
    context.globalAlpha = 1;

    const portrait = this.portrait.getContext("2d");
    if (portrait) {
      portrait.imageSmoothingEnabled = false;
      portrait.clearRect(0, 0, this.portrait.width, this.portrait.height);
      portrait.drawImage(frame, 0, 0, this.portrait.width, this.portrait.height);
    }
  }
}
