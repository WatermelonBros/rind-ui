/** @jsxImportSource solid-js */
import { visuallyHiddenStyle } from "@rind-ui/core"
import { createMemo, createSignal, type JSX, splitProps } from "solid-js"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"

export interface VisuallyHiddenState {
  readonly focused: boolean
}

export type VisuallyHiddenProps = Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** Visible while it has focus (skip links). */
  readonly focusable?: boolean | undefined
  readonly render?: RenderProp<VisuallyHiddenState> | undefined
  readonly children?: JSX.Element | ((state: VisuallyHiddenState) => JSX.Element)
}

/** Read by assistive technology, not seen (never `display: none`). */
export function VisuallyHidden(props: VisuallyHiddenProps) {
  const [local, rest] = splitProps(props, ["focusable", "render", "children"])
  const [focused, setFocused] = createSignal(false)
  const state = reactive<VisuallyHiddenState>(() => ({ focused: focused() }))
  const merged = createMemo(() => {
    const shown = local.focusable === true && focused()
    return mergeProps(
      normalizeProps({
        "data-visually-hidden": shown ? undefined : "",
        style: shown ? undefined : visuallyHiddenStyle,
      }),
      local.focusable
        ? { onFocusIn: () => setFocused(true), onFocusOut: () => setFocused(false) }
        : {},
      rest,
    )
  })
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <span {...p}>{children()}</span>)
}
