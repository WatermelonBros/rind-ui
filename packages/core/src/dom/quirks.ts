// The registry of every browser-, platform- and assistive-technology-specific workaround
// in rind-ui. Code checks an entry by id (`quirkActive`), never the user agent. The registry
// is declared in two halves keyed by the same ids, so runtime checks never bundle the
// metadata: `quirk-conditions.ts` (when each applies) and `quirk-meta.ts` (links, repro test,
// removal condition, last verification). This module joins them for consumers of the list.

import type { PlatformFlags } from "../env/capabilities"
import { type QuirkId, quirkConditions } from "./quirk-conditions"
import { type QuirkMeta, quirkMeta } from "./quirk-meta"

export { type QuirkId, quirkActive } from "./quirk-conditions"
export type { QuirkMeta, QuirksAffecting } from "./quirk-meta"

export interface Quirk<Id extends string = string> extends QuirkMeta {
  readonly id: Id
  /** When the workaround applies, from the injected platform. */
  readonly when: (platform: PlatformFlags) => boolean
}

/** Declares a list of entries, keeping their literal ids. */
/* @__NO_SIDE_EFFECTS__ */
export function defineQuirks<const Q extends readonly Quirk[]>(entries: Q): Q {
  return entries
}

/* @__NO_SIDE_EFFECTS__ */
function joinRegistry(): readonly Quirk<QuirkId>[] {
  // Object.keys is typed string[]; the keys are exactly QuirkId (`satisfies Record<QuirkId, …>`).
  return (Object.keys(quirkMeta) as QuirkId[]).map((id) => ({
    id,
    when: quirkConditions[id],
    ...quirkMeta[id],
  }))
}

/** Every entry, complete. Tree-shaken away unless imported. */
export const quirks = /* @__PURE__ */ joinRegistry()
