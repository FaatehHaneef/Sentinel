/**
 * The Sentinel loader: the one line a site owner adds to their pages.
 *
 * For ordinary visitors it does nothing at all: no network requests, no
 * storage, no changes to the page. It only wakes when the page was opened
 * from Sentinel with a launch token, or when a trial is already under way in
 * this tab. Even then, the engine it loads will not run until the Sentinel
 * server has confirmed the token for this exact site.
 */
(() => {
  const TOKEN_KEY = "sentinel:token";
  const STATE_KEY = "sentinel:state";
  const FRAGMENT = /(?:^#|&)sentinel=([A-Za-z0-9._-]+)/;

  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    document.querySelector<HTMLScriptElement>("script[data-site][src*='v.js']");
  if (!script) return;

  let active = false;
  try {
    const match = FRAGMENT.exec(window.location.hash);
    if (match) {
      window.sessionStorage.setItem(TOKEN_KEY, match[1]);
      // Remove the token from the address bar so it is not shared or bookmarked.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      active = true;
    } else {
      active = window.sessionStorage.getItem(STATE_KEY) !== null;
    }
  } catch {
    return;
  }
  if (!active) return;

  const base = new URL(script.src, window.location.href);
  (window as Window & { __sentinelBoot?: unknown }).__sentinelBoot = {
    apiBase: base.origin,
    siteKey: script.dataset.site ?? "",
  };
  const engine = document.createElement("script");
  engine.src = new URL("sentinel-engine.js", base).toString();
  engine.async = true;
  document.head.append(engine);
})();
