import { createHover, createPress, type HoverOptions, type PressOptions } from "@rind-ui/core"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"

/**
 * One press handle per element for the part's lifetime. Options are read at event time
 * (the latest render's), so `send` and `disabled` can change without recreating it.
 */
export function usePress(options: PressOptions) {
  const latest = useRef(options)
  latest.current = options
  const [handle] = useState(() =>
    createPress({
      get env() {
        return latest.current.env
      },
      send: (e) => latest.current.send(e),
      disabled: () => latest.current.disabled?.() === true,
      ...(options.focusOnPress === undefined ? {} : { focusOnPress: options.focusOnPress }),
      ...(options.longPress === undefined ? {} : { longPress: options.longPress }),
      ...(options.labelActivation === undefined
        ? {}
        : { labelActivation: options.labelActivation }),
      ...(options.suppressTouchContextMenu === undefined
        ? {}
        : { suppressTouchContextMenu: options.suppressTouchContextMenu }),
    }),
  )
  useEffect(() => () => handle.dispose(), [handle])
  const pressed = useSyncExternalStore(handle.subscribe, handle.isPressed, () => false)
  return { props: handle.props, pressed }
}

/** Hover for a part that opts in: mouse and pen only. */
export function useHover(options: HoverOptions) {
  const latest = useRef(options)
  latest.current = options
  const [handle] = useState(() =>
    createHover({
      get env() {
        return latest.current.env
      },
      send: (e) => latest.current.send(e),
      disabled: () => latest.current.disabled?.() === true,
    }),
  )
  const hovered = useSyncExternalStore(handle.subscribe, handle.isHovered, () => false)
  return { props: handle.props, hovered }
}
