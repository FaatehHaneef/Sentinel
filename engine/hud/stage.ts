import type { SpriteSheet } from "../art/sprite";
import type { Clock } from "../core/clock";

export type Animation = "idle" | "walk" | "squint" | "push" | "happy";

const SEQUENCES: Record<Animation, { frames: string[]; perSecond: number }> = {
  idle: { frames: ["idle"], perSecond: 1 },
  walk: { frames: ["walk1", "idle", "walk2", "idle"], perSecond: 8 },
  squint: { frames: ["squint"], perSecond: 1 },
  push: { frames: ["push", "push", "idle"], perSecond: 3 },
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
  private ghosts: Ghost[] = [];
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

  /** Shows ghosts beside the elements where the last trial hit a snag. */
  setGhosts(elements: Element[]): void {
    this.ghosts = elements.map((element) => ({ element, alpha: GHOST_ALPHA, fading: false }));
  }

  /** Lets the ghost at an element fade away. */
  releaseGhost(element: Element): void {
    for (const ghost of this.ghosts) {
      if (ghost.element === element) ghost.fading = true;
    }
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

    for (const ghost of this.ghosts) {
      if (ghost.fading) ghost.alpha -= dt * 0.9;
    }
    this.ghosts = this.ghosts.filter((ghost) => ghost.alpha > 0 && ghost.element.isConnected);
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

    // Ghosts of the previous trial, drawn first so the character walks in front of them.
    const ghostFrame = this.sprite.frames.squint ?? frame;
    if (this.spotFor) {
      for (const ghost of this.ghosts) {
        const spot = this.spotFor(ghost.element);
        context.globalAlpha = ghost.alpha;
        context.drawImage(
          ghostFrame,
          Math.round(spot.x - width / 2),
          Math.round(spot.y - height),
          width,
          height,
        );
      }
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
