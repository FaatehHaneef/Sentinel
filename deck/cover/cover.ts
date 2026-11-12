// Draws the Devpost cover: the seven shoppers squeezed into a selfie. Dash is
// closest, holding the phone at arm's length; everyone else crowds in with
// tilted heads and their own expressions. The busts are larger, more detailed
// versions of the sprites in engine/art, in the same colours. Everything is
// drawn on a 300×200 pixel grid and scaled up with hard edges.

const W = 300;
const H = 200;
const M = 90; // room around the picture, so tilted bodies still reach the edges
const OUTLINE = "#1a1426";
const DARK = "#2b2118";
const BLUSH = "#ec8f7d";

type Test = (x: number, y: number) => boolean;
type Eyes = "open" | "laugh" | "wink";
type Mouth = "grin" | "laugh" | "tongue" | "o";
type Pose = { eyes?: Eyes; mouth?: Mouth; turn?: number };

const key = (x: number, y: number) => (y + M) * (W + 2 * M) + (x + M);

/** One character's pixels, so each can be tilted and outlined before layering. */
class Layer {
  px = new Map<number, string>();

  set(x: number, y: number, colour: string) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < -M || y < -M || x >= W + M || y >= H + M) return;
    this.px.set(key(x, y), colour);
  }
  get(x: number, y: number) {
    return this.px.get(key(x, y));
  }
  fill(x0: number, y0: number, x1: number, y1: number, test: Test, colour: string) {
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
        if (test(x + 0.5, y + 0.5)) this.set(x, y, colour);
      }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, colour: string, only: Test = () => true) {
    this.fill(
      cx - rx - 1,
      cy - ry - 1,
      cx + rx + 1,
      cy + ry + 1,
      (x, y) => inEllipse(x, y, cx, cy, rx, ry) && only(x, y),
      colour,
    );
  }
  rect(x: number, y: number, w: number, h: number, colour: string) {
    this.fill(x, y, x + w - 1, y + h - 1, () => true, colour);
  }
  poly(points: [number, number][], colour: string) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    this.fill(
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs),
      Math.max(...ys),
      (x, y) => inPolygon(x, y, points),
      colour,
    );
  }
  line(x0: number, y0: number, x1: number, y1: number, width: number, colour: string) {
    this.fill(
      Math.min(x0, x1) - width,
      Math.min(y0, y1) - width,
      Math.max(x0, x1) + width,
      Math.max(y0, y1) + width,
      (x, y) => toSegment(x, y, x0, y0, x1, y1) <= width / 2,
      colour,
    );
  }
  ring(cx: number, cy: number, r: number, thickness: number, colour: string) {
    this.fill(
      cx - r - 1,
      cy - r - 1,
      cx + r + 1,
      cy + r + 1,
      (x, y) => {
        const d = Math.hypot(x - cx, y - cy);
        return d <= r && d >= r - thickness;
      },
      colour,
    );
  }
  /** A copy turned by some degrees around a point, sampling the nearest pixel. */
  tilted(cx: number, cy: number, degrees: number) {
    const out = new Layer();
    const a = (degrees * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    for (let y = -M; y < H + M; y++) {
      for (let x = -M; x < W + M; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const sx = Math.floor(cx + dx * cos + dy * sin);
        const sy = Math.floor(cy - dx * sin + dy * cos);
        const colour = this.get(sx, sy);
        if (colour) out.set(x, y, colour);
      }
    }
    return out;
  }
  /** A dark one-pixel line around the whole character. */
  outline() {
    const edge: [number, number][] = [];
    for (let y = -M + 1; y < H + M - 1; y++) {
      for (let x = -M + 1; x < W + M - 1; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1))
          edge.push([x, y]);
      }
    }
    for (const [x, y] of edge) this.set(x, y, OUTLINE);
    return this;
  }
  paint(context: CanvasRenderingContext2D) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const colour = this.get(x, y);
        if (!colour) continue;
        context.fillStyle = colour;
        context.fillRect(x, y, 1, 1);
      }
    }
  }
}

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

function inPolygon(x: number, y: number, points: [number, number][]) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function toSegment(x: number, y: number, x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy));
}

// ---- Shared parts -------------------------------------------------------------

type Skin = { base: string; shade: string };

/** A rounded torso from the shoulders down, well past the bottom of the picture. */
function torso(l: Layer, cx: number, top: number, half: number, colour: string, shade: string) {
  const bottom = H + 60;
  l.poly(
    [
      [cx - half + 4, top],
      [cx + half - 4, top],
      [cx + half + 2, top + 8],
      [cx + half + 8, bottom],
      [cx - half - 8, bottom],
      [cx - half - 2, top + 8],
    ],
    colour,
  );
  l.poly(
    [
      [cx + half - 6, top + 2],
      [cx + half + 2, top + 8],
      [cx + half + 8, bottom],
      [cx + half - 4, bottom],
    ],
    shade,
  );
}

function eye(l: Layer, x: number, y: number, s: number, kind: "open" | "shut") {
  if (kind === "open") {
    l.ellipse(x, y, 2.2 * s, 2.8 * s, DARK);
    l.set(x - 1 * s, y - 1.2 * s, "#ffffff");
  } else {
    l.line(x - 2.6 * s, y + 1 * s, x, y - 1.6 * s, 1.7, DARK);
    l.line(x, y - 1.6 * s, x + 2.6 * s, y + 1 * s, 1.7, DARK);
  }
}

function mouth(l: Layer, cx: number, top: number, s: number, kind: Mouth) {
  if (kind === "o") {
    l.ellipse(cx, top + 2 * s, 3 * s, 3.6 * s, "#6e2430");
    l.ellipse(cx, top + 4 * s, 2 * s, 1.4 * s, "#d9606a");
    return;
  }
  const rx = (kind === "laugh" ? 7 : 6) * s;
  const ry = (kind === "laugh" ? 7 : 5.5) * s;
  l.ellipse(cx, top, rx, ry, "#6e2430", (x, y) => y >= top);
  l.ellipse(cx, top, rx, ry, "#ffffff", (x, y) => y >= top && y < top + 2 * s);
  l.ellipse(
    cx,
    top + ry - 1.5 * s,
    3.5 * s,
    2 * s,
    "#d9606a",
    (x, y) => inEllipse(x, y, cx, top, rx, ry) && y > top + 2.5 * s,
  );
  if (kind === "tongue") {
    l.ellipse(cx + 1.5 * s, top + ry + 1 * s, 3 * s, 3.5 * s, "#e0707a");
    l.line(cx + 1.5 * s, top + ry - 1 * s, cx + 1.5 * s, top + ry + 3 * s, 1, "#c0505a");
  }
}

/** A face, with its features shifted by `turn` (−1 to 1) when it looks to one side. */
function face(
  l: Layer,
  cx: number,
  cy: number,
  s: number,
  skin: Skin,
  pose: Pose,
  drawEyes = true,
) {
  const rx = 15 * s;
  const ry = 17 * s;
  const turn = pose.turn ?? 0;
  const fx = cx + turn * 4 * s;
  if (turn < 0.6) l.ellipse(cx - rx, cy + 1 * s, 3 * s, 4 * s, skin.base);
  if (turn > -0.6) l.ellipse(cx + rx, cy + 1 * s, 3 * s, 4 * s, skin.shade);
  l.ellipse(cx, cy, rx, ry, skin.base);
  l.ellipse(cx, cy, rx, ry, skin.shade, (x, y) => !inEllipse(x, y, cx - 3 * s, cy - 2 * s, rx, ry));
  if (drawEyes) {
    const eyes = pose.eyes ?? "open";
    eye(l, fx - 6 * s, cy - 1 * s, s, eyes === "laugh" ? "shut" : "open");
    eye(l, fx + 6 * s, cy - 1 * s, s, eyes === "open" ? "open" : "shut");
    for (const side of [-1, 1])
      l.line(
        fx + side * 6 * s - 2.5 * s,
        cy - 6 * s,
        fx + side * 6 * s + 2.5 * s,
        cy - 6.5 * s,
        1.2,
        "#5a3a28",
      );
  }
  l.ellipse(fx - 9.5 * s, cy + 5 * s, 2.6 * s, 1.6 * s, BLUSH);
  l.ellipse(fx + 9.5 * s, cy + 5 * s, 2.6 * s, 1.6 * s, BLUSH);
  l.set(fx + 1 * s, cy + 3 * s, skin.shade);
  mouth(l, fx, cy + 7 * s, s, pose.mouth ?? "grin");
}

// ---- The seven ------------------------------------------------------------------

function iris(cx: number, cy: number, s: number, pose: Pose) {
  const l = new Layer();
  const skin = { base: "#f2c9a0", shade: "#d9a67c" };
  torso(l, cx, cy + 20 * s, 23 * s, "#6b5b95", "#4b3f6e");
  l.poly(
    [
      [cx - 22 * s, cy + 22 * s],
      [cx + 22 * s, cy + 22 * s],
      [cx + 27 * s, cy + 40 * s],
      [cx + 6 * s, cy + 52 * s],
      [cx - 6 * s, cy + 52 * s],
      [cx - 27 * s, cy + 40 * s],
    ],
    "#ffb347",
  );
  l.poly(
    [
      [cx + 10 * s, cy + 24 * s],
      [cx + 22 * s, cy + 22 * s],
      [cx + 27 * s, cy + 40 * s],
      [cx + 8 * s, cy + 50 * s],
    ],
    "#d98f2b",
  );
  l.rect(cx - 5 * s, cy + 14 * s, 10 * s, 8 * s, skin.shade);
  face(l, cx, cy, s, skin, pose, false);
  l.ellipse(cx, cy - 22 * s, 8 * s, 6 * s, "#d5d5e0");
  l.ellipse(cx + 2 * s, cy - 21 * s, 5 * s, 3 * s, "#a3a3b8", (x, y) => y > cy - 21 * s);
  l.ellipse(
    cx,
    cy - 7 * s,
    17 * s,
    13 * s,
    "#d5d5e0",
    (x, y) => y < cy - 7 * s || x < cx - 13 * s || x > cx + 13 * s,
  );
  l.ellipse(
    cx,
    cy - 7 * s,
    17 * s,
    13 * s,
    "#a3a3b8",
    (x, y) => (y < cy - 7 * s || x > cx + 13 * s) && x > cx + 6 * s,
  );
  // Round glasses, with laughing eyes behind them.
  const fx = cx + (pose.turn ?? 0) * 4 * s;
  for (const side of [-1, 1]) {
    const ex = fx + side * 6.5 * s;
    const ey = cy - 0.5 * s;
    l.ellipse(ex, ey, 5.2 * s, 5.2 * s, "#fdf3e3");
    eye(l, ex, ey + 0.5 * s, s, pose.eyes === "laugh" ? "shut" : "open");
    l.ring(ex, ey, 5.6 * s, 1.6, DARK);
    l.set(ex + 2.5 * s, ey - 3 * s, "#ffffff");
  }
  l.line(fx - 1.5 * s, cy - 1 * s, fx + 1.5 * s, cy - 1 * s, 1.4, DARK);
  return l;
}

function tobin(cx: number, cy: number, s: number, pose: Pose) {
  const l = new Layer();
  const skin = { base: "#f2c9a0", shade: "#d9a67c" };
  torso(l, cx, cy + 20 * s, 21 * s, "#f3e9d2", "#d8ccb4");
  l.poly(
    [
      [cx - 21 * s, cy + 22 * s],
      [cx - 4 * s, cy + 24 * s],
      [cx - 2 * s, H + 60],
      [cx - 30 * s, H + 60],
    ],
    "#6fae75",
  );
  l.poly(
    [
      [cx + 21 * s, cy + 22 * s],
      [cx + 4 * s, cy + 24 * s],
      [cx + 2 * s, H + 60],
      [cx + 30 * s, H + 60],
    ],
    "#4d8a57",
  );
  l.rect(cx - 5 * s, cy + 14 * s, 10 * s, 8 * s, skin.shade);
  face(l, cx, cy, s, skin, pose);
  const fx = cx + (pose.turn ?? 0) * 4 * s;
  l.ellipse(fx - 4 * s, cy + 6 * s, 5 * s, 2.2 * s, "#f4f4f4");
  l.ellipse(fx + 4 * s, cy + 6 * s, 5 * s, 2.2 * s, "#e2e2e2");
  l.ellipse(cx, cy - 11 * s, 17 * s, 9 * s, "#6b4a2f", (x, y) => y < cy - 7 * s);
  l.ellipse(cx + 4 * s, cy - 13 * s, 9 * s, 4 * s, "#8a6444", (x, y) => y < cy - 12 * s);
  l.ellipse(cx - 2 * s, cy - 7 * s, 17 * s, 3 * s, "#4d3421");
  return l;
}

function pell(cx: number, cy: number, s: number, pose: Pose) {
  const l = new Layer();
  const skin = { base: "#c98e62", shade: "#a8744c" };
  l.poly(
    [
      [cx - 30 * s, cy + 6 * s],
      [cx - 12 * s, cy + 4 * s],
      [cx - 10 * s, cy + 40 * s],
      [cx - 32 * s, cy + 40 * s],
    ],
    "#6b4a2f",
  );
  l.poly(
    [
      [cx - 31 * s, cy + 5 * s],
      [cx - 12 * s, cy + 3 * s],
      [cx - 12 * s, cy + 13 * s],
      [cx - 31 * s, cy + 15 * s],
    ],
    "#4d3421",
  );
  l.rect(cx - 23 * s, cy + 12 * s, 4 * s, 4 * s, "#ffb347");
  torso(l, cx, cy + 20 * s, 21 * s, "#8fa3bf", "#6b7f9c");
  l.line(cx - 12 * s, cy + 22 * s, cx - 8 * s, H + 40, 3 * s, "#4d3421");
  l.line(cx + 12 * s, cy + 22 * s, cx + 8 * s, H + 40, 3 * s, "#4d3421");
  l.rect(cx - 5 * s, cy + 14 * s, 10 * s, 8 * s, skin.shade);
  face(l, cx, cy, s, skin, pose);
  l.ellipse(cx, cy - 9 * s, 26 * s, 5 * s, "#5c4a3a");
  l.ellipse(cx, cy - 16 * s, 13 * s, 10 * s, "#5c4a3a", (x, y) => y < cy - 9 * s);
  l.rect(cx - 13 * s, cy - 12 * s, 26 * s, 3 * s, "#44362a");
  return l;
}

function knock(cx: number, cy: number, s: number) {
  const l = new Layer();
  torso(l, cx, cy + 20 * s, 22 * s, "#c9d3e2", "#8fa3bf");
  l.poly(
    [
      [cx - 12 * s, cy + 26 * s],
      [cx + 12 * s, cy + 26 * s],
      [cx + 16 * s, H + 60],
      [cx - 16 * s, H + 60],
    ],
    "#f3e9d2",
  );
  l.rect(cx - 5 * s, cy + 34 * s, 10 * s, 10 * s, "#ffb347");
  l.poly(
    [
      [cx - 3 * s, cy - 17 * s],
      [cx + 2 * s, cy - 33 * s],
      [cx + 12 * s, cy - 28 * s],
      [cx + 5 * s, cy - 16 * s],
    ],
    "#e8743b",
  );
  l.poly(
    [
      [cx + 2 * s, cy - 30 * s],
      [cx + 11 * s, cy - 27 * s],
      [cx + 6 * s, cy - 22 * s],
    ],
    "#ff9a5c",
  );
  l.ellipse(cx, cy - 2 * s, 17 * s, 19 * s, "#8fa3bf");
  l.ellipse(
    cx,
    cy - 2 * s,
    17 * s,
    19 * s,
    "#6b7f9c",
    (x, y) => !inEllipse(x, y, cx - 4 * s, cy - 4 * s, 17 * s, 19 * s),
  );
  l.rect(cx - 1 * s, cy - 20 * s, 2 * s, 12 * s, "#c9d3e2");
  l.rect(cx - 13 * s, cy - 3 * s, 26 * s, 8 * s, "#1b1f3b");
  for (const side of [-1, 1]) {
    const ex = cx + side * 6 * s;
    l.line(ex - 2.5 * s, cy + 2 * s, ex, cy - 0.5 * s, 1.6, "#f2c9a0");
    l.line(ex, cy - 0.5 * s, ex + 2.5 * s, cy + 2 * s, 1.6, "#f2c9a0");
  }
  for (let i = -2; i <= 2; i++) l.rect(cx + i * 4 * s - 0.5, cy + 9 * s, 1, 3 * s, "#6b7f9c");
  return l;
}

function echo(cx: number, cy: number, s: number, pose: Pose) {
  const l = new Layer();
  const skin = { base: "#d9a67c", shade: "#b98558" };
  // Waving.
  l.line(cx + 18 * s, cy + 28 * s, cx + 32 * s, cy - 18 * s, 9 * s, "#8fa3bf");
  l.ellipse(cx + 34 * s, cy - 25 * s, 5.5 * s, 6.5 * s, skin.base);
  for (let i = 0; i < 4; i++)
    l.line(
      cx + 30 * s + i * 3 * s,
      cy - 29 * s,
      cx + 29 * s + i * 3.4 * s,
      cy - 36 * s + Math.abs(i - 1.5) * 2 * s,
      2.2 * s,
      skin.base,
    );
  l.line(cx + 39 * s, cy - 23 * s, cx + 43 * s, cy - 28 * s, 2.2 * s, skin.base);
  l.ellipse(cx, cy + 4 * s, 19 * s, 24 * s, "#3a2a20");
  torso(l, cx, cy + 20 * s, 21 * s, "#8fa3bf", "#6b7f9c");
  l.rect(cx - 5 * s, cy + 14 * s, 10 * s, 8 * s, skin.shade);
  face(l, cx, cy, s, skin, pose);
  l.ellipse(cx, cy - 8 * s, 16.5 * s, 11 * s, "#3a2a20", (x, y) => y < cy - 7 * s);
  l.ellipse(cx - 6 * s, cy - 8 * s, 8 * s, 4 * s, "#3a2a20", (x, y) => y < cy - 4 * s);
  l.ring(cx, cy - 2 * s, 20 * s, 3 * s, "#e05a6d");
  for (const side of [-1, 1])
    l.ellipse(cx + side * 17 * s, cy + 1 * s, 4.5 * s, 6.5 * s, "#a83a4c");
  return l;
}

function dash(cx: number, cy: number, s: number, pose: Pose) {
  const l = new Layer();
  const skin = { base: "#e2b08a", shade: "#c48e66" };
  torso(l, cx, cy + 20 * s, 22 * s, "#e8743b", "#b9552a");
  l.ellipse(cx, cy + 20 * s, 14 * s, 5 * s, "#b9552a");
  l.line(cx - 4 * s, cy + 24 * s, cx - 5 * s, cy + 36 * s, 1.5, "#f3e9d2");
  l.line(cx + 4 * s, cy + 24 * s, cx + 5 * s, cy + 36 * s, 1.5, "#f3e9d2");
  // His arm, reaching out of the picture towards the camera.
  l.poly(
    [
      [cx - 24 * s, cy + 18 * s],
      [cx - 6 * s, cy + 30 * s],
      [cx - 30 * s, H + 60],
      [cx - 90 * s, H + 20],
    ],
    "#e8743b",
  );
  l.poly(
    [
      [cx - 12 * s, cy + 26 * s],
      [cx - 6 * s, cy + 30 * s],
      [cx - 30 * s, H + 60],
      [cx - 46 * s, H + 50],
    ],
    "#b9552a",
  );
  l.rect(cx - 5 * s, cy + 14 * s, 10 * s, 8 * s, skin.shade);
  face(l, cx, cy, s, skin, pose);
  l.ellipse(cx, cy - 9 * s, 16.5 * s, 10 * s, "#2b2118", (x, y) => y < cy - 7 * s);
  for (let i = -3; i <= 3; i++) {
    const x = cx + i * 5 * s;
    l.poly(
      [
        [x - 4 * s, cy - 14 * s],
        [x + 4 * s, cy - 14 * s],
        [x + i * 1.5 * s, cy - 26 * s + Math.abs(i) * 2.5 * s],
      ],
      "#2b2118",
    );
  }
  return l;
}

function cog(cx: number, cy: number, s: number) {
  const l = new Layer();
  torso(l, cx, cy + 20 * s, 22 * s, "#c9a24a", "#9c7a2e");
  l.rect(cx - 6 * s, cy + 15 * s, 12 * s, 7 * s, "#8fa3bf");
  for (const [dx, colour] of [
    [-8, "#6fae75"],
    [0, "#ffb347"],
    [8, "#e05a6d"],
  ] as const)
    l.ellipse(cx + dx * s, cy + 34 * s, 2 * s, 2 * s, colour);
  // A peace sign.
  l.line(cx + 18 * s, cy + 26 * s, cx + 27 * s, cy + 4 * s, 5 * s, "#8fa3bf");
  l.ellipse(cx + 28 * s, cy + 1 * s, 5 * s, 4.5 * s, "#c9a24a");
  l.line(cx + 25 * s, cy - 2 * s, cx + 21 * s, cy - 13 * s, 3 * s, "#c9a24a");
  l.line(cx + 30 * s, cy - 2 * s, cx + 35 * s, cy - 12 * s, 3 * s, "#c9a24a");
  // Antenna and head.
  l.line(cx + 6 * s, cy - 17 * s, cx + 10 * s, cy - 23 * s, 2 * s, "#8a7a5c");
  l.ellipse(cx + 11 * s, cy - 25 * s, 3.2 * s, 3.2 * s, "#ffe08a");
  l.poly(
    [
      [cx - 16 * s, cy - 12 * s],
      [cx - 12 * s, cy - 18 * s],
      [cx + 12 * s, cy - 18 * s],
      [cx + 16 * s, cy - 12 * s],
      [cx + 16 * s, cy + 12 * s],
      [cx + 12 * s, cy + 17 * s],
      [cx - 12 * s, cy + 17 * s],
      [cx - 16 * s, cy + 12 * s],
    ],
    "#c9a24a",
  );
  l.poly(
    [
      [cx + 10 * s, cy - 18 * s],
      [cx + 12 * s, cy - 18 * s],
      [cx + 16 * s, cy - 12 * s],
      [cx + 16 * s, cy + 12 * s],
      [cx + 12 * s, cy + 17 * s],
      [cx + 8 * s, cy + 17 * s],
    ],
    "#9c7a2e",
  );
  for (const side of [-1, 1])
    l.rect(cx + side * 17 * s - 2 * s, cy - 3 * s, 4 * s, 7 * s, "#8fa3bf");
  l.ellipse(cx, cy - 3 * s, 9 * s, 9 * s, "#e8743b");
  l.ellipse(cx, cy - 3 * s, 6.5 * s, 6.5 * s, "#ffb347");
  l.ellipse(cx, cy - 3 * s, 2.5 * s, 2.5 * s, DARK);
  l.ellipse(cx - 2.5 * s, cy - 5.5 * s, 1.5 * s, 1.5 * s, "#ffffff");
  l.fill(
    cx - 7 * s,
    cy + 8 * s,
    cx + 7 * s,
    cy + 14 * s,
    (x, y) => {
      const curve = cy + 12 * s - ((x - cx) / (7 * s)) ** 2 * 3 * s;
      return Math.abs(y - curve) < 1.4 * s && Math.abs(x - cx) < 7 * s;
    },
    DARK,
  );
  l.ellipse(cx - 11 * s, cy + 6 * s, 2 * s, 1.4 * s, BLUSH);
  l.ellipse(cx + 11 * s, cy + 6 * s, 2 * s, 1.4 * s, BLUSH);
  return l;
}

// ---- The picture ----------------------------------------------------------------

const canvas = document.querySelector<HTMLCanvasElement>("#crowd")!;
canvas.width = W;
canvas.height = H;
const context = canvas.getContext("2d")!;

// Back to front: the people at the back, then the ones leaning in, then Dash,
// who is holding the phone and so is closest and biggest.
const shots: [Layer, number, number, number][] = [
  [tobin(74, 84, 0.92, { eyes: "laugh", mouth: "laugh", turn: 0.4 }), 74, 84, -13],
  [pell(124, 78, 0.88, { mouth: "o", turn: 0.3 }), 124, 78, 7],
  [knock(180, 82, 0.88), 180, 82, 15],
  [echo(232, 84, 0.92, { eyes: "wink", turn: -0.4 }), 232, 84, -9],
  [cog(224, 136, 1.12), 224, 136, 11],
  [iris(160, 128, 1.2, { eyes: "laugh", mouth: "laugh", turn: -0.2 }), 160, 128, -7],
  [dash(86, 142, 1.42, { eyes: "wink", mouth: "tongue", turn: 0.45 }), 86, 142, 9],
];
for (const [layer, cx, cy, tilt] of shots) layer.tilted(cx, cy, tilt).outline().paint(context);
document.body.dataset.ready = "1";
