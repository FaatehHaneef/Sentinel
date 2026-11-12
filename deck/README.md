# Sentinel deck

The submission slides, kept apart from the app. It's one plain HTML page with no build step.

- **Present:** open `index.html` in a browser. Use the arrow keys, space, or a click to move. Press F11 for full screen. The address keeps the slide number (`#5`), so you can link straight to a slide.
- **Exports:** `export/sentinel-deck.pdf` has every slide on its own page. `export/slide-01.png` to `slide-12.png` are 1280×720 images for the Devpost gallery.
- **Pictures:** `assets/` holds copies of the app's showcase screenshots. To refresh them, run `node scripts/capture-showcase.mjs` and copy them over again.
- **Publish:** this folder is a static site. To give it its own link, import the repo into Vercel as a new project and set **Root Directory** to `deck`, with the framework preset set to "Other".
