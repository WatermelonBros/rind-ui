import { booleanAttribute, computed, Directive, input, type Signal, signal } from "@angular/core"
import { visuallyHiddenStyle } from "@rind-ui/core"
import { bindProps } from "../bind-props"

export interface VisuallyHiddenState {
  readonly focused: boolean
}

/** Read by assistive technology, not seen (never `display: none`): `<span rindVisuallyHidden>`. */
@Directive({ selector: "[rindVisuallyHidden]", exportAs: "rindVisuallyHidden" })
export class VisuallyHidden {
  /** Visible while it has focus (skip links). */
  readonly focusable = input(false, { transform: booleanAttribute })
  /** For the template (`#v="rindVisuallyHidden"`, `v.state()`). */
  readonly state: Signal<VisuallyHiddenState>

  constructor() {
    const focused = signal(false)
    this.state = computed(() => ({ focused: focused() }))
    bindProps(
      () => {
        const shown = this.focusable() && focused()
        return {
          "data-visually-hidden": shown ? undefined : "",
          style: shown ? undefined : visuallyHiddenStyle,
          ...(this.focusable()
            ? { onFocusIn: () => focused.set(true), onFocusOut: () => focused.set(false) }
            : {}),
        }
      },
      { owns: ["focusable"] },
    )
  }
}
