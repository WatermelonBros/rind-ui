import { cloneElement, createElement, type ReactElement, type ReactNode } from "react"
import { mergeProps, stripMarker } from "./merge-props"

type Props = Record<string | symbol, unknown>

/**
 * Element substitution: an element (receives the part's props, merged with its own) or a
 * function of the merged props and the part's state.
 */
export type RenderProp<S = undefined> =
  | ReactElement
  | ((props: Record<string, unknown>, state: S) => ReactNode)

/** Renders a part as its default tag, or through the consumer's `render` prop. */
export function renderPart<S>(
  tag: string,
  props: Props,
  render: RenderProp<S> | undefined,
  state: S,
): ReactNode {
  if (render === undefined) return createElement(tag, stripMarker(props))
  if (typeof render === "function") return render(stripMarker(props), state)
  // The element's own props are the innermost consumer layer (React 19 exposes `ref` among
  // them): merged in the same pass, so its preventRindHandler() skips only the part's handler
  // and its critical overrides warn.
  return cloneElement(render, stripMarker(mergeProps(props, render.props as Props)))
}
