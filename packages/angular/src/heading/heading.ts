import {
  afterRenderEffect,
  computed,
  Directive,
  ElementRef,
  forwardRef,
  InjectionToken,
  inject,
  input,
  PLATFORM_ID,
  type Signal,
} from "@angular/core"
import {
  type HeadingLevel,
  headingConnect,
  nextHeadingLevel,
  resolveHeadingLevel,
  tooDeep,
  warnEmptyHeading,
  warnTooDeep,
} from "@rind-ui/core"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"

/** The raw (unclamped) level of the nearest `rindHeadingLevel`; injection crosses portals. */
/** @internal (not exported from the package): an Accordion panel provides its deeper level. */
export const HEADING_LEVEL = new InjectionToken<Signal<number | undefined>>("rind-ui.heading")

/** The level a heading gets at this position (1–6). Call it in an injection context. */
export function injectHeadingLevel(): Signal<HeadingLevel> {
  const context = inject(HEADING_LEVEL, { optional: true })
  return computed(() => resolveHeadingLevel(undefined, context?.()))
}

/**
 * A section: the headings below get `level` (default: one more than the level around it).
 * Renders no element on an `<ng-container rindHeadingLevel>`.
 */
@Directive({
  selector: "[rindHeadingLevel]",
  exportAs: "rindHeadingLevel",
  providers: [
    { provide: HEADING_LEVEL, useFactory: () => inject(forwardRef(() => HeadingLevelSection)).raw },
  ],
})
export class HeadingLevelSection {
  /** The level for the headings below; default: one more than the level around it. */
  readonly level = input<HeadingLevel | undefined, HeadingLevel | "" | undefined>(undefined, {
    alias: "rindHeadingLevel",
    // A bare `rindHeadingLevel` attribute: one more than the level around it.
    transform: (v) => (v === "" ? undefined : v),
  })
  private readonly parent = inject(HEADING_LEVEL, { optional: true, skipSelf: true })
  /** @internal */
  readonly raw = computed(() => nextHeadingLevel(this.parent?.(), this.level()))
}

/**
 * A heading whose level follows the nesting of `rindHeadingLevel` sections (default 2). The
 * element is yours: on the matching `<h{level}>` it adds nothing, on another heading element
 * `aria-level`, on any other element `role="heading"` and `aria-level`. `#h="rindHeading"`
 * gives `h.level()`, to pick the element with `@switch`.
 */
@Directive({ selector: "[rindHeading]", exportAs: "rindHeading" })
export class Heading {
  /** Overrides the level from the nesting. */
  readonly explicit = input<HeadingLevel | undefined, HeadingLevel | "" | undefined>(undefined, {
    alias: "rindHeading",
    // A bare `rindHeading` attribute sets no level.
    transform: (v) => (v === "" ? undefined : v),
  })
  readonly id = input<string>()

  private readonly context = inject(HEADING_LEVEL, { optional: true })
  /** The heading's level (1–6). */
  readonly level = computed(() => resolveHeadingLevel(this.explicit(), this.context?.()))

  constructor() {
    const el: Element = inject(ElementRef).nativeElement
    const tag = el.tagName.toLowerCase()
    const instance = injectRootId(() => this.id())
    bindProps(
      () => ({
        ...headingConnect({ level: this.level(), tag, instance: instance() }),
        ...(this.id() === undefined ? {} : { id: this.id() }),
      }),
      { owns: ["id"] },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    let warnedDeep = false
    afterRenderEffect(() => {
      const ctx = this.context?.()
      if (this.explicit() === undefined && tooDeep(ctx) && ctx !== undefined && !warnedDeep) {
        warnedDeep = true
        warnTooDeep(ctx)
      }
      warnEmptyHeading(el)
    })
  }
}
