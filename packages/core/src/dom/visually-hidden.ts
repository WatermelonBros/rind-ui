// Content read by assistive technology but not seen. One style for rind-ui: 1 px, clipped
// with both `clip` and `clip-path`, no wrapping, and `position: fixed` so it never causes
// scroll jumps inside scroll containers. The input variant is `position: absolute`, so
// native validation bubbles anchor near the control. Never `display: none` for content that
// must be announced or that provides a name from content.

export const visuallyHiddenStyle = {
  border: "0",
  clip: "rect(0 0 0 0)",
  "clip-path": "inset(50%)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: "0",
  position: "fixed",
  top: "0",
  left: "0",
  "white-space": "nowrap",
  width: "1px",
} as const

/** For hidden native form inputs: anchored where the control is. */
export const visuallyHiddenInputStyle = { ...visuallyHiddenStyle, position: "absolute" } as const

/** Applies the style to an element rind-ui creates itself (the announcer container). */
export function applyVisuallyHidden(el: HTMLElement): void {
  for (const [name, value] of Object.entries(visuallyHiddenStyle)) el.style.setProperty(name, value)
}

/** Props for a hidden native input: out of the tab order and of the accessibility tree. */
export const hiddenInputProps = {
  tabindex: -1,
  "aria-hidden": "true",
  style: visuallyHiddenInputStyle,
} as const
