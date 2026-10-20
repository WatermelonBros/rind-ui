"use client"

import {
  droppedNameProps,
  type SeparatorContext,
  type SeparatorInput,
  type SeparatorOrientation,
  separatorProps,
  separatorWarnings,
} from "@rind-ui/core"
import { type ComponentPropsWithRef, createContext, useContext, useEffect, useRef } from "react"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useRenderedTag } from "../use-rendered-tag"

/**
 * What a container tells the separators inside it (a Toolbar: context `toolbar`, the
 * perpendicular default orientation; a listbox popup: `listbox`).
 */
export interface SeparatorHost {
  readonly context: SeparatorContext
  readonly defaultOrientation?: SeparatorOrientation | undefined
}
export const SeparatorHostContext = createContext<SeparatorHost | null>(null)

export interface SeparatorState {
  readonly orientation: SeparatorOrientation
  readonly decorative: boolean
}

export type SeparatorProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
  /** Default: the container's, else `horizontal`. */
  readonly orientation?: SeparatorOrientation
  /** Purely visual: `role="none"`, removed from the accessibility tree. */
  readonly decorative?: boolean
  /** Ignored when the rendered element is void (`<hr>`). */
  readonly children?: ComponentPropsWithRef<"div">["children"]
  readonly render?: RenderProp<SeparatorState>
}

const VOID = new Set(["hr", "br", "img", "input", "wbr"])

function SeparatorRoot({
  orientation,
  decorative = false,
  render,
  id,
  ref,
  children,
  ...rest
}: SeparatorProps) {
  const host = useContext(SeparatorHostContext)
  const instance = useRootId(id)
  const el = useRef<HTMLElement | null>(null)
  const tag = useRenderedTag("div", render, el)
  const input: SeparatorInput = {
    orientation,
    defaultOrientation: host?.defaultOrientation,
    decorative,
    tag,
    context: host?.context ?? "content",
    instance,
    own: rest as Readonly<Record<string, unknown>>, // the element's own props, read by name
  }
  // Warn once per change of what the warnings read, not on every render.
  const latest = useRef(input)
  latest.current = input
  const named = rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined
  const warnKey = JSON.stringify([orientation, decorative, input.context, rest.tabIndex, named])
  useEffect(() => {
    if (warnKey) separatorWarnings(latest.current)
  }, [warnKey])
  const consumer: Record<string, unknown> = { ...rest }
  for (const name of droppedNameProps(input)) delete consumer[name]
  const own = normalizeProps(separatorProps(input))
  const props = mergeProps(
    { ...own, ...(id === undefined ? {} : { id }), ref: composeRefs(el, ref) },
    consumer,
  )
  const state = {
    orientation: own["data-orientation"] as SeparatorOrientation, // set by separatorProps
    decorative: own["data-decorative"] !== undefined,
  }
  return renderPart(
    "div",
    VOID.has(tag) || children === undefined ? props : { ...props, children },
    render,
    state,
  )
}

/** A static divider between groups of content or controls; never focusable. */
export const Separator = { Root: SeparatorRoot }
