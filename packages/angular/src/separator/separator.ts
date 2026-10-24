import {
  afterRenderEffect,
  booleanAttribute,
  Directive,
  ElementRef,
  InjectionToken,
  inject,
  input,
  PLATFORM_ID,
  type Signal,
} from "@angular/core"
import {
  droppedNameProps,
  type SeparatorContext,
  type SeparatorInput,
  type SeparatorOrientation,
  separatorProps,
  separatorWarnings,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"

/**
 * What a container tells the separators inside it (a Toolbar: context `toolbar`, the
 * perpendicular default orientation; a listbox popup: `listbox`).
 */
export interface SeparatorHost {
  readonly context: SeparatorContext
  readonly defaultOrientation?: SeparatorOrientation | undefined
}
export const SEPARATOR_HOST = new InjectionToken<Signal<SeparatorHost | null>>(
  "rind-ui.separator-host",
)

/** A divider: `<div rindSeparatorRoot></div>`, or `<hr rindSeparatorRoot>`. */
@Directive({ selector: "[rindSeparatorRoot]", exportAs: "rindSeparatorRoot" })
export class SeparatorRoot {
  /** Default: the container's, else `horizontal`. */
  readonly orientation = input<SeparatorOrientation>()
  /** Purely visual: `role="none"`, removed from the accessibility tree. */
  readonly decorative = input(false, { transform: booleanAttribute })
  readonly id = input<string>()

  constructor() {
    const host = inject(SEPARATOR_HOST, { optional: true })
    const el: Element = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    const instance = injectRootId(() => this.id())
    let statics: ReadonlyMap<string, string> = new Map()
    const input_ = (): SeparatorInput => ({
      orientation: this.orientation(),
      defaultOrientation: host?.()?.defaultOrientation,
      decorative: this.decorative(),
      tag,
      context: host?.()?.context ?? "content",
      instance: instance(),
      own: Object.fromEntries(statics),
    })
    statics = bindProps(
      () => ({
        ...separatorProps(input_()),
        ...(this.id() === undefined ? {} : { id: this.id() }),
      }),
      { owns: ["decorative", "id", "orientation"], drop: () => droppedNameProps(input_()) },
    ).statics
    if (inject(PLATFORM_ID) !== "browser") return
    // Warnings once per change of what they read (not on every render).
    let last: string | undefined
    afterRenderEffect(() => {
      const current = input_()
      const key = JSON.stringify([current.orientation, current.decorative, current.context])
      if (key === last) return
      last = key
      separatorWarnings(current)
    })
  }
}

/** The Separator's directives, for a standalone component's `imports`. */
export const Separator = [SeparatorRoot] as const
