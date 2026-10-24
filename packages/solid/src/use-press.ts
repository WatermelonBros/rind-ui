import { createHover, createPress, type HoverOptions, type PressOptions } from "@rind-ui/core"
import { createSignal, onCleanup } from "solid-js"
import { afterMount } from "./lifecycle"
import { normalizeProps } from "./normalize-props"

/**
 * One press handle per element for the part's lifetime. Options are read at event time, so
 * `send` and `disabled` may close over reactive state.
 */
export function usePress(options: PressOptions) {
  const handle = createPress(options)
  const [pressed, setPressed] = createSignal(false)
  afterMount(() => {
    const off = handle.subscribe(setPressed)
    onCleanup(() => {
      off()
      handle.dispose()
    })
  })
  return { props: normalizeProps(handle.props), pressed }
}

/** Hover for a part that opts in: mouse and pen only. */
export function useHover(options: HoverOptions) {
  const handle = createHover(options)
  const [hovered, setHovered] = createSignal(false)
  afterMount(() => onCleanup(handle.subscribe(() => setHovered(handle.isHovered()))))
  return { props: normalizeProps(handle.props), hovered }
}
