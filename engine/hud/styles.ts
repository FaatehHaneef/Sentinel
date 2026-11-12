/** Styles for the on-page display. They live inside a shadow root, so they cannot leak into the page. */
export const HUD_STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  pointer-events: none;
  font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", Menlo, Consolas, monospace;
  font-size: 14px;
  line-height: 1.4;
  color: #f3e9d2;
}
* { box-sizing: border-box; }
.lens {
  position: absolute; inset: 0; display: none;
}
.lens.blur {
  backdrop-filter: blur(1.6px) contrast(0.78) saturate(0.85);
  -webkit-backdrop-filter: blur(1.6px) contrast(0.78) saturate(0.85);
}
.lens.dark { background: rgba(8, 9, 20, 0.96); }
button[hidden] { display: none; }
.lens.on { display: block; }
.stage { position: absolute; inset: 0; width: 100%; height: 100%; }
.highlight {
  position: absolute; display: none; border: 3px solid #ffb347; border-radius: 4px;
  box-shadow: 0 0 0 3px rgba(18, 21, 42, 0.55), 0 0 18px rgba(255, 179, 71, 0.7);
  transition: all 120ms ease-out;
}
.highlight.on { display: block; }
.highlight.bad { border-color: #e05a6d; box-shadow: 0 0 0 3px rgba(18, 21, 42, 0.55), 0 0 18px rgba(224, 90, 109, 0.75); }
.panel {
  position: absolute; top: 12px; right: 12px; width: 320px; max-height: calc(100% - 24px);
  display: flex; flex-direction: column; gap: 10px; padding: 12px;
  background: #1b1f3b; border: 3px solid #ffb347; border-radius: 6px;
  box-shadow: 0 6px 0 #12152a, 0 12px 28px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
}
.panel.left { right: auto; left: 12px; }
.who { display: flex; gap: 10px; align-items: center; }
.portrait {
  width: 64px; height: 96px; flex: none; image-rendering: pixelated;
  background: #2e3a5c; border: 2px solid #8fa3bf; border-radius: 4px;
}
.name { font-size: 18px; font-weight: 700; color: #ffb347; margin: 0; }
.role { margin: 2px 0 0; color: #8fa3bf; font-size: 12px; }
.say {
  margin: 0; padding: 8px 10px; min-height: 40px; background: #f3e9d2; color: #1b1f3b;
  border-radius: 4px; font-size: 13px;
}
.meters { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 0; }
.meter { background: #12152a; border-radius: 4px; padding: 6px 8px; }
.meter dt { font-size: 11px; color: #8fa3bf; text-transform: uppercase; letter-spacing: 0.08em; }
.meter dd { margin: 0; font-size: 16px; font-weight: 700; }
.meter .bar { height: 6px; margin-top: 5px; background: #2e3a5c; border-radius: 3px; overflow: hidden; }
.meter .bar i { display: block; height: 100%; width: 100%; background: #ffb347; transition: width 300ms ease-out; }
.feed {
  list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px;
  overflow-y: auto; min-height: 0; flex: 1 1 auto; max-height: 260px;
}
.feed li {
  display: grid; grid-template-columns: 18px 1fr auto; gap: 6px; align-items: start;
  padding: 6px 8px; background: #2e3a5c; border-left: 4px solid #8fa3bf; border-radius: 3px; font-size: 12px;
  animation: slide 180ms ease-out;
}
.feed li.pass { border-left-color: #6fae75; }
.feed li.snag { border-left-color: #e05a6d; }
.feed li.good { border-left-color: #ffb347; }
.feed li.bad { border-left-color: #e05a6d; background: #43273a; }
.feed .mark { font-weight: 700; }
.feed .detail { display: block; color: #c9d3e2; margin-top: 2px; }
.feed .delta { font-weight: 700; white-space: nowrap; }
.feed li.pass .delta, .feed li.good .delta { color: #9fd6a5; }
.feed li.snag .delta, .feed li.bad .delta { color: #ffb0bb; }
.feed button.jump {
  all: unset; cursor: pointer; text-decoration: underline; text-underline-offset: 2px;
}
.controls { display: flex; flex-wrap: wrap; gap: 6px; }
.controls button, .summary a {
  font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; padding: 6px 9px;
  color: #f3e9d2; background: #2e3a5c; border: 2px solid #8fa3bf; border-radius: 4px; text-decoration: none;
}
.controls button[aria-pressed="true"] { background: #ffb347; color: #1b1f3b; border-color: #ffb347; }
.controls button:hover, .summary a:hover { border-color: #ffb347; }
button:focus-visible, a:focus-visible { outline: 3px solid #ffb347; outline-offset: 2px; }
.summary { display: none; flex-direction: column; gap: 8px; padding: 10px; background: #12152a; border-radius: 4px; }
.summary.on { display: flex; }
.summary h2 { margin: 0; font-size: 16px; color: #ffb347; }
.summary p { margin: 0; font-size: 13px; }
.summary a { align-self: flex-start; background: #ffb347; color: #1b1f3b; border-color: #ffb347; font-size: 13px; }
@keyframes slide { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: none; } }
@media (max-width: 720px) {
  .panel, .panel.left { top: auto; bottom: 8px; left: 8px; right: 8px; width: auto; max-height: 46%; }
  .portrait { width: 40px; height: 60px; }
  .feed { max-height: 120px; }
}
@media (prefers-reduced-motion: reduce) {
  .feed li { animation: none; }
  .highlight, .meter .bar i { transition: none; }
}
`;
