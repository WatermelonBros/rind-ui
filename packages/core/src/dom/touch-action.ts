// Removes the double-tap-to-zoom delay on pressable parts with `touch-action: pan-x pan-y
// pinch-zoom`, injected once per document (inject-style.ts). Never `manipulation`: in Safari
// it stops `pointercancel` from firing when a touch turns into a scroll (WebKit 240917).

import type { StyleEnv } from "../env/capabilities"
import { injectStyle } from "./inject-style"

export const TOUCH_ACTION_RULE = "[data-rind-pressable] { touch-action: pan-x pan-y pinch-zoom }"

export function injectTouchAction(doc: Document, env: Partial<StyleEnv> = {}): void {
  injectStyle(doc, "touch-action", TOUCH_ACTION_RULE, env)
}
