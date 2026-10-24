import { createHover, createPress, type HoverOptions, type PressOptions } from "@rind-ui/core"
import { untrack } from "svelte"
import { normalizeProps } from "./normalize-props"

/**
 * One press handle per element for the part's lifetime. Options are read at event time, so
 * `send` and `disabled` may close over reactive state. Read `.pressed`.
 */
export function usePress(options: PressOptions) {
  const handle = createPress(options)
  let pressed = $state(false)
  $effect(() => {
    // Untracked: a press can end inside a block's update (its element removed while
    // focused fires blur synchronously), where writing tracked state is unsafe.
    const off = handle.subscribe((p) => untrack(() => (pressed = p)))
    return () => {
      off()
      handle.dispose()
    }
  })
  return {
    props: normalizeProps(handle.props),
    get pressed() {
      return pressed
    },
  }
}

/** Hover for a part that opts in: mouse and pen only. Read `.hovered`. */
export function useHover(options: HoverOptions) {
  const handle = createHover(options)
  let hovered = $state(false)
  $effect(() => handle.subscribe(() => untrack(() => (hovered = handle.isHovered()))))
  return {
    props: normalizeProps(handle.props),
    get hovered() {
      return hovered
    },
  }
}
