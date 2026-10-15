import { visuallyHiddenStyle } from "@rind-ui/core"
import { type ComponentPropsWithRef, useState } from "react"
import { mergeProps } from "./merge-props"
import { normalizeProps } from "./normalize-props"
import { type RenderProp, renderPart } from "./render"

export type VisuallyHiddenProps = ComponentPropsWithRef<"span"> & {
  /** Visible while it has focus (skip links). */
  readonly focusable?: boolean
  readonly render?: RenderProp<{ focused: boolean }>
}

/** Read by assistive technology, not seen (never `display: none`). */
export function VisuallyHidden({ focusable = false, render, ...rest }: VisuallyHiddenProps) {
  const [focused, setFocused] = useState(false)
  const shown = focusable && focused
  const own = normalizeProps({
    "data-visually-hidden": shown ? undefined : "",
    style: shown ? undefined : visuallyHiddenStyle,
  })
  const props = mergeProps(
    own,
    focusable ? { onFocus: () => setFocused(true), onBlur: () => setFocused(false) } : {},
    rest,
  )
  return renderPart("span", props, render, { focused })
}
