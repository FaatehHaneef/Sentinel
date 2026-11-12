"use client";

import { useSyncExternalStore } from "react";
import { readStoreFixes, STORE_FIX_ATTRIBUTE } from "@/lib/store/variants";

const noSubscription = () => () => {};

/**
 * The shop front's banner. Its box is reserved by the page, so the picture
 * never pushes anything around when it arrives.
 *
 * Deliberate snag for the trials: unless the "hero-image" store fix is
 * switched on, the picture is a 1600 pixel wide, grainy PNG of well over a
 * megabyte, shown at 1000 pixels. On a slow connection that is a long wait.
 */
export function Banner() {
  // null while rendering on the server: the picture is chosen in the browser.
  const fixed = useSyncExternalStore(
    noSubscription,
    () => readStoreFixes(window.localStorage).includes("hero-image"),
    () => null,
  );
  if (fixed === null) return null;

  const alt = "The lantern market at dusk, with candles on the counter";
  const common = {
    className: "pixelated h-full w-full object-cover",
    [STORE_FIX_ATTRIBUTE]: "hero-image",
  };
  return fixed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/store/banner.png" width={1000} height={375} alt={alt} {...common} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/store/banner-heavy.png" alt={alt} {...common} />
  );
}
