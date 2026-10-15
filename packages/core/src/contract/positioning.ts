// The query fragment every anchored component's contract spreads: placement read from the
// positioner's attributes only, never from geometry (geometry is the layout invariant's).

import type { Env } from "./env"

type E = Env<"positioner">

export const positioningQueries = {
  /** The physical side the popup was placed on, or null when not open. */
  side: async (env: E) => env.part("positioner").attr("data-side"),
  align: async (env: E) => env.part("positioner").attr("data-align"),
  isAnchorHidden: async (env: E) =>
    (await env.part("positioner").exists()) &&
    (await env.part("positioner").attr("data-anchor-hidden")) !== null,
  /** Open and placed: the first placement of this open has been written. */
  isPlaced: async (env: E) =>
    (await env.part("positioner").exists()) &&
    (await env.part("positioner").attr("data-placing")) === null,
}
