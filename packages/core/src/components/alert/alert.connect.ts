// Alert parts (design §4): no role and no live attribute on any part (the Announcer speaks),
// no name on Root (a generic element cannot be named; the region recipe names it with the
// Title's id), a decorative or labelled Icon, and a CloseTrigger named by `messages.dismiss`
// only when it has no name of its own.

import { focusAttrs } from "../../a11y/focus"
import { type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { partId } from "../../ids"

declare const process: { env: { NODE_ENV?: string } }

export type AlertPart = "root" | "icon" | "title" | "description" | "close-trigger"

export interface AlertConnectInput {
  readonly instance: string
  readonly open: boolean
  readonly dismissLabel: string
}

const LIVE_ROLES = new Set(["alert", "status", "log"])
const LIVE_ATTRS = ["aria-live", "aria-atomic", "aria-relevant", "aria-busy"]

const warn = (message: string) => console.warn(`[rind-ui] alert: ${message}`)

/**
 * Render-time development warning over the Root's own props: a live role or attribute makes
 * a second, uncontrolled announcement (and is re-spoken when the DOM moves). Forwarded anyway.
 */
export function alertWarnings(own: Readonly<Record<string, unknown>>): void {
  if (process.env.NODE_ENV === "production") return
  const role = own["role"]
  if ((typeof role === "string" && LIVE_ROLES.has(role)) || LIVE_ATTRS.some((a) => a in own)) {
    warn(
      'an alert is never a live region of its own; remove the live role or attribute and set the announce prop ("polite" or "assertive")',
    )
  }
}

/** Ids of the parts the region recipe references (`aria-labelledby={titleId}`). */
export const alertIds = (instance: string) => ({
  title: partId("alert", instance, "title"),
  description: partId("alert", instance, "description"),
})

export function alertConnect(input: AlertConnectInput) {
  const ids = alertIds(input.instance)
  const base = (part: AlertPart) => scopeAttrs("alert", part, input.instance)
  return {
    root: (): PartProps => ({
      ...base("root"),
      "data-state": input.open ? "open" : "closed",
    }),
    /** Decorative unless labelled: the label puts the severity in the alert's text. */
    icon: (label?: string): PartProps =>
      label === undefined
        ? { ...base("icon"), "aria-hidden": "true" }
        : { ...base("icon"), role: "img", "aria-label": label },
    title: (): PartProps => ({ ...base("title"), id: ids.title }),
    description: (): PartProps => ({ ...base("description"), id: ids.description }),
    /** `named`: the trigger has text content or a consumer name. */
    closeTrigger: (s: {
      readonly named: boolean
      readonly focused: boolean
      readonly modality: Modality
    }): PartProps => ({
      ...base("close-trigger"),
      type: "button",
      "aria-label": s.named ? undefined : input.dismissLabel,
      ...focusAttrs(s.focused, s.modality),
    }),
  }
}
