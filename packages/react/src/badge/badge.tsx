"use client"

import { badgeConnect, badgeWarnings, checkBadgeHost } from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"

// useLayoutEffect warns on the server; it never runs there anyway.
const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export interface BadgeState {
  /** A `label` replaces what assistive technology hears. */
  readonly labelled: boolean
}

export type BadgeProps = ComponentPropsWithRef<"span"> & {
  /** The text assistive technology gets instead of the visible content ("99+"). */
  readonly label?: string
  readonly render?: RenderProp<BadgeState>
}

function BadgeRoot({ label, render, id, ref, children, ...rest }: BadgeProps) {
  const instance = useRootId(id)
  const el = useRef<HTMLElement | null>(null)
  const api = badgeConnect({ label, instance })
  const content = api.content()
  const hidden = api.label()
  const own = rest as Readonly<Record<string, unknown>> // the element's own props, read by name
  // Warn once per change of what the warnings read, not on every render.
  const warnKey = JSON.stringify([
    rest.role,
    rest["aria-live"],
    rest["aria-label"],
    rest["aria-labelledby"],
  ])
  const latest = useRef(own)
  latest.current = own
  useEffect(() => {
    if (warnKey) badgeWarnings(latest.current)
  }, [warnKey])
  useIsoLayoutEffect(() => {
    if (el.current) checkBadgeHost(el.current, label)
  })
  const body =
    content && hidden ? (
      <>
        {createElement("span", normalizeProps(content), children)}
        {createElement("span", normalizeProps(hidden), label)}
      </>
    ) : (
      children
    )
  const props = mergeProps(
    { ...normalizeProps(api.root()), ref: composeRefs(el, ref), children: body },
    rest,
  )
  return renderPart("span", props, render, { labelled: content !== null })
}

/** Static status text (a count, a label, a dot): never interactive, never a live region. */
export const Badge = { Root: BadgeRoot }
