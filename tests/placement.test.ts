import { describe, expect, it } from "vitest";
import { chooseCorner, cost, panelBox } from "@/engine/hud/placement";

const viewport = { width: 1280, height: 800 };
const size = { width: 320, height: 500 };

describe("trial panel placement", () => {
  it("places the panel in the requested corner", () => {
    expect(panelBox("top-right", 320, 500, viewport)).toEqual({
      left: 948,
      top: 12,
      right: 1268,
      bottom: 512,
    });
    expect(panelBox("bottom-left", 320, 500, viewport)).toEqual({
      left: 12,
      top: 288,
      right: 332,
      bottom: 788,
    });
  });

  it("moves away from what matters most", () => {
    // A form field being checked on the right side of the screen.
    const items = [{ box: { left: 1000, top: 100, right: 1200, bottom: 140 }, weight: 12 }];
    expect(chooseCorner("top-right", size, viewport, items)).toBe("top-left");
  });

  it("stays put when nothing it covers matters, or the gain is tiny", () => {
    expect(chooseCorner("top-right", size, viewport, [])).toBe("top-right");
    const sliver = [{ box: { left: 940, top: 100, right: 950, bottom: 110 }, weight: 1 }];
    expect(chooseCorner("top-right", size, viewport, sliver)).toBe("top-right");
  });

  it("weighs the element being checked above ordinary content", () => {
    const checked = { box: { left: 1000, top: 100, right: 1200, bottom: 200 }, weight: 12 };
    const ordinary = { box: { left: 50, top: 100, right: 250, bottom: 200 }, weight: 1 };
    const right = cost(panelBox("top-right", 320, 500, viewport), [checked, ordinary]);
    const left = cost(panelBox("top-left", 320, 500, viewport), [checked, ordinary]);
    expect(left).toBeLessThan(right);
  });
});
