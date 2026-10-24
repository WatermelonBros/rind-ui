import { createHover, createPress, type HoverOptions, type PressOptions } from "@rind-ui/core"
import { onBeforeUnmount, onMounted, shallowRef } from "vue"
import { normalizeProps } from "./normalize-props"

/**
 * One press handle per element for the part's lifetime. Options are read at event time, so
 * `send` and `disabled` may close over reactive state.
 */
export function usePress(options: PressOptions) {
  const handle = createPress(options)
  const pressed = shallowRef(false)
  onMounted(() => {
    const off = handle.subscribe((p) => (pressed.value = p))
    onBeforeUnmount(() => {
      off()
      handle.dispose()
    })
  })
  return { props: normalizeProps(handle.props), pressed }
}

/** Hover for a part that opts in: mouse and pen only. */
export function useHover(options: HoverOptions) {
  const handle = createHover(options)
  const hovered = shallowRef(false)
  onMounted(() => {
    const off = handle.subscribe(() => (hovered.value = handle.isHovered()))
    onBeforeUnmount(off)
  })
  return { props: normalizeProps(handle.props), hovered }
}
