// Badge has no machine (design §1, Separator precedent): one pure function decides what a
// badge exposes. It never carries a role or a live region; a `label` replaces what
// assistive technology hears with a text node (translated with the page), the visible
// content hidden from it.

import { type PartProps, scopeAttrs } from "../../connect/props"
import { visuallyHiddenStyle } from "../../dom/visually-hidden"

declare const process: { env: { NODE_ENV?: string } }

export interface BadgeInput {
  /** The text assistive technology gets instead of the visible content ("99+"). */
  readonly label?: string | undefined
  /** The instance id; also the root's `id`, so a host can list it in `aria-describedby`. */
  readonly instance: string
}

const LIVE_ROLES = new Set(["status", "alert", "log"])

const warn = (message: string) => console.warn(`[rind-ui] badge: ${message}`)

/**
 * Render-time development warnings over the consumer's own props: a live role or
 * `aria-live` (a badge never speaks: use the Announcer), and a name on the root (ignored on
 * a generic element: use `label`). The props are forwarded anyway.
 */
export function badgeWarnings(own: Readonly<Record<string, unknown>>): void {
  if (process.env.NODE_ENV === "production") return
  const role = own["role"]
  if ((typeof role === "string" && LIVE_ROLES.has(role)) || own["aria-live"] !== undefined) {
    warn(
      "a badge is never a live region; remove the live role or aria-live and announce a change with the Announcer",
    )
  }
  if (own["aria-label"] !== undefined || own["aria-labelledby"] !== undefined) {
    warn(
      "aria-label and aria-labelledby are ignored on a badge (a generic element); use the label prop",
    )
  }
}

export const badgeConnect = (input: BadgeInput) => {
  const labelled = input.label !== undefined
  return {
    root: (): PartProps => ({ ...scopeAttrs("badge", "root", input.instance), id: input.instance }),
    /** The wrapper of the visible content, only with `label`. */
    content: (): PartProps | null => (labelled ? { "aria-hidden": "true" } : null),
    /** The visually hidden label, only with `label`. */
    label: (): PartProps | null =>
      labelled ? { "data-visually-hidden": "", style: visuallyHiddenStyle } : null,
  }
}
