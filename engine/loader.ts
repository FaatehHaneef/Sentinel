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
  const base = new URL(script.src, window.location.href);
  let loaded = false;

  /** Moves a launch token from the address bar into this tab's storage. Returns true if there was one. */
  function takeToken(): boolean {
    const match = FRAGMENT.exec(window.location.hash);
    if (!match) return false;
    window.sessionStorage.setItem(TOKEN_KEY, match[1]);
    // Remove the token from the address bar so it is not shared or bookmarked.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    return true;
  }

  function loadEngine(): void {
    if (loaded) return;
    loaded = true;
    (window as Window & { __sentinelBoot?: unknown }).__sentinelBoot = {
      apiBase: base.origin,
      siteKey: script!.dataset.site ?? "",
    };
    const engine = document.createElement("script");
    engine.src = new URL("sentinel-engine.js", base).toString();
    engine.async = true;
    document.head.append(engine);
  }

  try {
    if (takeToken() || window.sessionStorage.getItem(STATE_KEY) !== null) loadEngine();
  } catch {
    return;
  }

  // A trial link opened on a page that is already loaded changes only the fragment.
  window.addEventListener("hashchange", () => {
    try {
      if (takeToken()) loadEngine();
    } catch {
      // Storage is unavailable: the trial cannot start in this tab.
    }
  });
})();
