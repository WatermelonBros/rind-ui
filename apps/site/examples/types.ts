/** One live example: its title, one line of why, and how the examples harness treats it. */
export type Variant = {
  readonly title: string
  readonly description?: string
  /** On the harness only (a test fixture or a ported story), not listed on the docs page. */
  readonly hidden?: boolean
  /** Axe rules this example breaks on purpose (e.g. `heading-order` for skipped levels). */
  readonly axeDisable?: readonly string[]
  /** Viewport the example is meant for; tests open it there. */
  readonly viewport?: "mobile"
  /** Keep real motion on the harness (exit animations, presence); the default is reduced. */
  readonly motion?: "keep"
}

/** A module's live examples, keyed by the exported function's name, in page order. */
export type Variants = Readonly<Record<string, Variant>>

/**
 * State examples: contract scope → machine state → the example that leaves the component in
 * that state. Tests check that every contract state has one.
 */
export type States = Readonly<Record<string, Readonly<Record<string, string>>>>
