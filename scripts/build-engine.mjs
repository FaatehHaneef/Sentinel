// Bundles the code that runs inside tested pages into two files in public/:
// v.js (the tiny loader) and sentinel-engine.js (loaded only during a trial).
import { build, context } from "esbuild";

const watch = process.argv.includes("--watch");

const shared = {
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  tsconfig: "tsconfig.json",
  logLevel: "info",
};

const targets = [
  { ...shared, entryPoints: ["engine/loader.ts"], outfile: "public/v.js" },
  { ...shared, entryPoints: ["engine/index.ts"], outfile: "public/sentinel-engine.js" },
];

if (watch) {
  for (const target of targets) {
    const ctx = await context(target);
    await ctx.watch();
  }
} else {
  await Promise.all(targets.map((target) => build(target)));
}
