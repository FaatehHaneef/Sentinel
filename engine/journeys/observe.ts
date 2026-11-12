import type { Journey } from "./types";

/**
 * The journey on a site whose owner installed Sentinel: observe only.
 *
 * On a site that is not Sentinel's own demo store, the shoppers never click,
 * type, submit or pay. They look at the page the trial opened on, run every
 * check, react, and report. That is all.
 */
export function observeJourney(): Journey {
  return {
    // A nominal cart of $20 sets the size of the purse for the coin count.
    unitCents: 2000,
    startPath: "/",
    observeOnly: true,
    prepare() {},
    orderId: () => "",
    scenes: [
      {
        id: "page",
        name: "The page",
        funnel: 1,
        match: () => document.readyState !== "loading",
        path: () => [],
        async advance() {},
      },
    ],
  };
}
