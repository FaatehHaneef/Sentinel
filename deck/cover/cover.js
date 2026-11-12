"use strict";
(() => {
  // deck/cover/cover.ts
  var W = 300;
  var H = 200;
  var OUTLINE = "#1a1426";
  var Layer = class {
    constructor() {
      this.px = /* @__PURE__ */ new Map();
    }
    set(x, y, colour) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      this.px.set(y * W + x, colour);
    }
    has(x, y) {
      return this.px.has(y * W + x);
    }
    fill(x0, y0, x1, y1, test, colour) {
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
        for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
          if (test(x + 0.5, y + 0.5)) this.set(x, y, colour);
        }
      }
    }
    ellipse(cx, cy, rx, ry, colour, only = () => true) {
      this.fill(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => inEllipse(x, y, cx, cy, rx, ry) && only(x, y), colour);
    }
    rect(x, y, w, h, colour) {
      this.fill(x, y, x + w - 1, y + h - 1, () => true, colour);
    }
    poly(points, colour) {
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      this.fill(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (x, y) => inPolygon(x, y, points), colour);
    }
    line(x0, y0, x1, y1, width, colour) {
      const pad = width;
      this.fill(Math.min(x0, x1) - pad, Math.min(y0, y1) - pad, Math.max(x0, x1) + pad, Math.max(y0, y1) + pad, (x, y) => toSegment(x, y, x0, y0, x1, y1) <= width / 2, colour);
    }
    ring(cx, cy, r, thickness, colour) {
      this.fill(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (x, y) => {
        const d = Math.hypot(x - cx, y - cy);
        return d <= r && d >= r - thickness;
      }, colour);
    }
    /** A dark one-pixel line around the whole character. */
    outline() {
      const edge = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (this.has(x, y)) continue;
          if (this.has(x - 1, y) || this.has(x + 1, y) || this.has(x, y - 1) || this.has(x, y + 1)) edge.push(y * W + x);
        }
      }
      for (const key of edge) this.px.set(key, OUTLINE);
    }
    paint(context2) {
      for (const [key, colour] of this.px) {
        context2.fillStyle = colour;
        context2.fillRect(key % W, Math.floor(key / W), 1, 1);
      }
    }
  };
  var inEllipse = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  function inPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function toSegment(x, y, x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy));
  }
  var BLUSH = "#ec8f7d";
  var DARK = "#2b2118";
  function torso(l, cx, top, half, colour, shade) {
    l.poly([[cx - half + 4, top], [cx + half - 4, top], [cx + half + 2, top + 8], [cx + half + 6, H + 2], [cx - half - 6, H + 2], [cx - half - 2, top + 8]], colour);
    l.poly([[cx + half - 6, top + 2], [cx + half + 2, top + 8], [cx + half + 6, H + 2], [cx + half - 4, H + 2]], shade);
  }
  function face(l, cx, cy, s, skin, eyes = true) {
    const rx = 15 * s;
    const ry = 17 * s;
    l.ellipse(cx - rx, cy + 1 * s, 3 * s, 4 * s, skin.base);
    l.ellipse(cx + rx, cy + 1 * s, 3 * s, 4 * s, skin.shade);
    l.ellipse(cx, cy, rx, ry, skin.base);
    l.ellipse(cx, cy, rx, ry, skin.shade, (x, y) => !inEllipse(x, y, cx - 3 * s, cy - 2 * s, rx, ry));
    if (eyes) {
      for (const side of [-1, 1]) {
        const ex = cx + side * 6 * s;
        const ey = cy - 1 * s;
        l.ellipse(ex, ey, 2.2 * s, 2.8 * s, DARK);
        l.set(Math.round(ex - 1 * s), Math.round(ey - 1.2 * s), "#ffffff");
        l.line(ex - 2.5 * s, ey - 5 * s, ex + 2.5 * s, ey - 5.5 * s, 1.2, "#5a3a28");
      }
    }
    l.ellipse(cx - 9.5 * s, cy + 5 * s, 2.6 * s, 1.6 * s, BLUSH);
    l.ellipse(cx + 9.5 * s, cy + 5 * s, 2.6 * s, 1.6 * s, BLUSH);
    l.set(Math.round(cx + 1 * s), Math.round(cy + 3 * s), skin.shade);
    smile(l, cx, cy + 7 * s, s);
  }
  function smile(l, cx, top, s) {
    const rx = 6 * s;
    const ry = 5.5 * s;
    l.ellipse(cx, top, rx, ry, "#6e2430", (x, y) => y >= top);
    l.ellipse(cx, top, rx, ry, "#ffffff", (x, y) => y >= top && y < top + 2 * s);
    l.ellipse(cx, top + 4 * s, 3.5 * s, 2 * s, "#d9606a", (x, y) => inEllipse(x, y, cx, top, rx, ry) && y > top + 2.5 * s);
  }
  function iris(cx, cy, s) {
    const l = new Layer();
    const skin = { base: "#f2c9a0", shade: "#d9a67c" };
    torso(l, cx, cy + 20 * s, 23 * s, "#6b5b95", "#4b3f6e");
    l.poly([[cx - 22 * s, cy + 22 * s], [cx + 22 * s, cy + 22 * s], [cx + 27 * s, cy + 40 * s], [cx + 6 * s, cy + 52 * s], [cx - 6 * s, cy + 52 * s], [cx - 27 * s, cy + 40 * s]], "#ffb347");
    l.poly([[cx + 10 * s, cy + 24 * s], [cx + 22 * s, cy + 22 * s], [cx + 27 * s, cy + 40 * s], [cx + 8 * s, cy + 50 * s]], "#d98f2b");
    l.rect(cx - 5 * s, cy + 14 * s, 10 * s, 8 * s, skin.shade);
    face(l, cx, cy, s, skin, false);
    l.ellipse(cx, cy - 22 * s, 8 * s, 6 * s, "#d5d5e0");
    l.ellipse(cx + 2 * s, cy - 21 * s, 5 * s, 3 * s, "#a3a3b8", (x, y) => y > cy - 21 * s);
    l.ellipse(cx, cy - 7 * s, 17 * s, 13 * s, "#d5d5e0", (x, y) => y < cy - 7 * s || x < cx - 13 * s || x > cx + 13 * s);
    l.ellipse(cx, cy - 7 * s, 17 * s, 13 * s, "#a3a3b8", (x, y) => (y < cy - 7 * s || x > cx + 13 * s) && x > cx + 6 * s);
    for (const side of [-1, 1]) {
      const ex = cx + side * 6.5 * s;
      const ey = cy - 0.5 * s;
      l.ellipse(ex, ey, 5.2 * s, 5.2 * s, "#fdf3e3");
      l.ellipse(ex, ey + 0.5 * s, 2 * s, 2.6 * s, DARK);
      l.set(Math.round(ex - 1 * s), Math.round(ey - 0.8 * s), "#ffffff");
      l.ring(ex, ey, 5.6 * s, 1.6, DARK);
      l.set(Math.round(ex + 2.5 * s), Math.round(ey - 3 * s), "#ffffff");
    }
    l.line(cx - 1.5 * s, cy - 1 * s, cx + 1.5 * s, cy - 1 * s, 1.4, DARK);
    return l;
  }
  function tobin(cx, cy, s) {
    const l = new Layer();
    const skin = { base: "#f2c9a0", shade: "#d9a67c" };
    torso(l, cx, cy + 20 * s, 21 * s, "#f3e9d2", "#d8ccb4");
    l.poly([[cx - 21 * s, cy + 22 * s], [cx - 4 * s, cy + 24 * s], [cx - 2 * s, H + 2], [cx - 28 * s, H + 2]], "#6fae75");
    l.poly([[cx + 21 * s, cy + 22 * s], [cx + 4 * s, cy + 24 * s], [cx + 2 * s, H + 2], [cx + 28 * s, H + 2]], "#4d8a57");
    for (let i = 0; i < 3; i++) l.ellipse(cx - 6 * s, cy + 32 * s + i * 8 * s, 1.2 * s, 1.2 * s, "#2f5e3a");
    l.rect(cx - 5 * s, cy + 14 * s, 10 * s, 8 * s, skin.shade);
    face(l, cx, cy, s, skin);
    l.ellipse(cx - 4 * s, cy + 6 * s, 5 * s, 2.2 * s, "#f4f4f4");
    l.ellipse(cx + 4 * s, cy + 6 * s, 5 * s, 2.2 * s, "#e2e2e2");
    l.ellipse(cx, cy - 11 * s, 17 * s, 9 * s, "#6b4a2f", (x, y) => y < cy - 7 * s);
    l.ellipse(cx + 4 * s, cy - 13 * s, 9 * s, 4 * s, "#8a6444", (x, y) => y < cy - 12 * s);
    l.ellipse(cx - 2 * s, cy - 7 * s, 17 * s, 3 * s, "#4d3421");
    return l;
  }
  function pell(cx, cy, s) {
    const l = new Layer();
    const skin = { base: "#c98e62", shade: "#a8744c" };
    l.poly([[cx - 30 * s, cy + 6 * s], [cx - 12 * s, cy + 4 * s], [cx - 10 * s, cy + 40 * s], [cx - 32 * s, cy + 40 * s]], "#6b4a2f");
    l.poly([[cx - 31 * s, cy + 5 * s], [cx - 12 * s, cy + 3 * s], [cx - 12 * s, cy + 13 * s], [cx - 31 * s, cy + 15 * s]], "#4d3421");
    l.rect(cx - 23 * s, cy + 12 * s, 4 * s, 4 * s, "#ffb347");
    l.rect(cx - 27 * s, cy + 2 * s, 12 * s, 3 * s, "#4d3421");
    torso(l, cx, cy + 20 * s, 21 * s, "#8fa3bf", "#6b7f9c");
    l.line(cx - 12 * s, cy + 22 * s, cx - 8 * s, H, 3 * s, "#4d3421");
    l.line(cx + 12 * s, cy + 22 * s, cx + 8 * s, H, 3 * s, "#4d3421");
    l.rect(cx - 5 * s, cy + 14 * s, 10 * s, 8 * s, skin.shade);
    face(l, cx, cy, s, skin);
    l.ellipse(cx, cy - 9 * s, 26 * s, 5 * s, "#5c4a3a");
    l.ellipse(cx, cy - 16 * s, 13 * s, 10 * s, "#5c4a3a", (x, y) => y < cy - 9 * s);
    l.rect(cx - 13 * s, cy - 12 * s, 26 * s, 3 * s, "#44362a");
    return l;
  }
  function knock(cx, cy, s) {
    const l = new Layer();
    torso(l, cx, cy + 20 * s, 22 * s, "#c9d3e2", "#8fa3bf");
    l.poly([[cx - 12 * s, cy + 26 * s], [cx + 12 * s, cy + 26 * s], [cx + 14 * s, H + 2], [cx - 14 * s, H + 2]], "#f3e9d2");
    l.rect(cx - 5 * s, cy + 34 * s, 10 * s, 10 * s, "#ffb347");
    l.rect(cx - 1 * s, cy + 36 * s, 2 * s, 6 * s, "#c47a1e");
    l.poly([[cx - 3 * s, cy - 17 * s], [cx + 2 * s, cy - 33 * s], [cx + 12 * s, cy - 28 * s], [cx + 5 * s, cy - 16 * s]], "#e8743b");
    l.poly([[cx + 2 * s, cy - 30 * s], [cx + 11 * s, cy - 27 * s], [cx + 6 * s, cy - 22 * s]], "#ff9a5c");
    l.ellipse(cx, cy - 2 * s, 17 * s, 19 * s, "#8fa3bf");
    l.ellipse(cx, cy - 2 * s, 17 * s, 19 * s, "#6b7f9c", (x, y) => !inEllipse(x, y, cx - 4 * s, cy - 4 * s, 17 * s, 19 * s));
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
  function echo(cx, cy, s) {
    const l = new Layer();
    const skin = { base: "#d9a67c", shade: "#b98558" };
    l.line(cx + 18 * s, cy + 28 * s, cx + 34 * s, cy - 20 * s, 9 * s, "#8fa3bf");
    l.ellipse(cx + 36 * s, cy - 27 * s, 5.5 * s, 6.5 * s, skin.base);
    for (let i = 0; i < 4; i++) l.line(cx + 32 * s + i * 3 * s, cy - 31 * s, cx + 31 * s + i * 3.4 * s, cy - 38 * s + Math.abs(i - 1.5) * 2 * s, 2.2 * s, skin.base);
    l.line(cx + 41 * s, cy - 25 * s, cx + 45 * s, cy - 30 * s, 2.2 * s, skin.base);
    l.ellipse(cx, cy + 4 * s, 19 * s, 24 * s, "#3a2a20");
    torso(l, cx, cy + 20 * s, 21 * s, "#8fa3bf", "#6b7f9c");
    l.rect(cx - 5 * s, cy + 14 * s, 10 * s, 8 * s, skin.shade);
    face(l, cx, cy, s, skin);
    l.ellipse(cx, cy - 8 * s, 16.5 * s, 11 * s, "#3a2a20", (x, y) => y < cy - 7 * s);
    l.ellipse(cx - 6 * s, cy - 8 * s, 8 * s, 4 * s, "#3a2a20", (x, y) => y < cy - 4 * s);
    l.ring(cx, cy - 2 * s, 20 * s, 3 * s, "#e05a6d");
    l.fill(cx - 22 * s, cy - 2 * s, cx + 22 * s, cy + 20 * s, () => false, "");
    for (const side of [-1, 1]) l.ellipse(cx + side * 17 * s, cy + 1 * s, 4.5 * s, 6.5 * s, "#a83a4c");
    return l;
  }
  function dash(cx, cy, s) {
    const l = new Layer();
    const skin = { base: "#e2b08a", shade: "#c48e66" };
    torso(l, cx, cy + 20 * s, 22 * s, "#e8743b", "#b9552a");
    l.ellipse(cx, cy + 20 * s, 14 * s, 5 * s, "#b9552a");
    l.line(cx - 4 * s, cy + 24 * s, cx - 5 * s, cy + 36 * s, 1.5, "#f3e9d2");
    l.line(cx + 4 * s, cy + 24 * s, cx + 5 * s, cy + 36 * s, 1.5, "#f3e9d2");
    l.poly([[cx - 24 * s, cy + 22 * s], [cx - 8 * s, cy + 32 * s], [44, H + 4], [-4, H + 4], [-4, H - 34]], "#e8743b");
    l.poly([[cx - 12 * s, cy + 28 * s], [cx - 8 * s, cy + 32 * s], [44, H + 4], [26, H + 4]], "#b9552a");
    l.line(-2, H - 12, 34, H + 2, 3, "#b9552a");
    l.rect(cx - 5 * s, cy + 14 * s, 10 * s, 8 * s, skin.shade);
    face(l, cx, cy, s, skin);
    l.ellipse(cx, cy - 9 * s, 16.5 * s, 10 * s, "#2b2118", (x, y) => y < cy - 7 * s);
    for (let i = -3; i <= 3; i++) {
      const x = cx + i * 5 * s;
      l.poly([[x - 4 * s, cy - 14 * s], [x + 4 * s, cy - 14 * s], [x + i * 1.5 * s, cy - 26 * s + Math.abs(i) * 2.5 * s]], "#2b2118");
    }
    return l;
  }
  function cog(cx, cy, s) {
    const l = new Layer();
    torso(l, cx, cy + 20 * s, 22 * s, "#c9a24a", "#9c7a2e");
    l.rect(cx - 6 * s, cy + 15 * s, 12 * s, 7 * s, "#8fa3bf");
    l.ellipse(cx - 8 * s, cy + 34 * s, 2 * s, 2 * s, "#6fae75");
    l.ellipse(cx, cy + 34 * s, 2 * s, 2 * s, "#ffb347");
    l.ellipse(cx + 8 * s, cy + 34 * s, 2 * s, 2 * s, "#e05a6d");
    l.line(cx + 6 * s, cy - 17 * s, cx + 10 * s, cy - 23 * s, 2 * s, "#8a7a5c");
    l.ellipse(cx + 11 * s, cy - 25 * s, 3.2 * s, 3.2 * s, "#ffe08a");
    l.poly([[cx - 16 * s, cy - 12 * s], [cx - 12 * s, cy - 18 * s], [cx + 12 * s, cy - 18 * s], [cx + 16 * s, cy - 12 * s], [cx + 16 * s, cy + 12 * s], [cx + 12 * s, cy + 17 * s], [cx - 12 * s, cy + 17 * s], [cx - 16 * s, cy + 12 * s]], "#c9a24a");
    l.poly([[cx + 10 * s, cy - 18 * s], [cx + 12 * s, cy - 18 * s], [cx + 16 * s, cy - 12 * s], [cx + 16 * s, cy + 12 * s], [cx + 12 * s, cy + 17 * s], [cx + 8 * s, cy + 17 * s]], "#9c7a2e");
    for (const side of [-1, 1]) l.rect(cx + side * 17 * s - 2 * s, cy - 3 * s, 4 * s, 7 * s, "#8fa3bf");
    l.ellipse(cx, cy - 3 * s, 9 * s, 9 * s, "#e8743b");
    l.ellipse(cx, cy - 3 * s, 6.5 * s, 6.5 * s, "#ffb347");
    l.ellipse(cx, cy - 3 * s, 2.5 * s, 2.5 * s, DARK);
    l.ellipse(cx - 2.5 * s, cy - 5.5 * s, 1.5 * s, 1.5 * s, "#ffffff");
    l.fill(cx - 7 * s, cy + 8 * s, cx + 7 * s, cy + 14 * s, (x, y) => {
      const curve = cy + 9 * s + ((x - cx) / (7 * s)) ** 2 * -3 * s + 3 * s;
      return Math.abs(y - curve) < 1.4 * s && Math.abs(x - cx) < 7 * s;
    }, DARK);
    l.ellipse(cx - 11 * s, cy + 6 * s, 2 * s, 1.4 * s, BLUSH);
    l.ellipse(cx + 11 * s, cy + 6 * s, 2 * s, 1.4 * s, BLUSH);
    return l;
  }
  var canvas = document.querySelector("#crowd");
  canvas.width = W;
  canvas.height = H;
  var context = canvas.getContext("2d");
  var back = 0.95;
  var front = 1.22;
  var people = [
    tobin(70, 96, back),
    pell(118, 90, back),
    knock(170, 90, back),
    echo(222, 92, back),
    dash(86, 140, front),
    cog(228, 146, front),
    iris(155, 134, front)
  ];
  for (const person of people) {
    person.outline();
    person.paint(context);
  }
  document.body.dataset.ready = "1";
})();
