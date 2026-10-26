// The variant family matrix (openspec theme-variants, "Family Matrix") as data. The token
// manifest generator, the theme tests and the docs read it; a component change adds its
// scope to exactly one row here. Scopes are the components' `data-scope` values.

export type Variant = "solid" | "soft" | "outline" | "ghost"
export type Size = "sm" | "md" | "lg"
export type FamilyName =
  | "action"
  | "toggle item"
  | "field"
  | "choice"
  | "selector"
  | "status"
  | "identity"
  | "panel"
  | "collection item"
  | "link"
  | "range"
  | "decoration"

/**
 * `own`: the component takes `data-size` itself (`sizes`, default `md`). `inherited`: it reads
 * the `data-size` of an ancestor (only `sizedComponents`, if given, take their own).
 * `none`: no size at all.
 */
export type SizeMode = "own" | "inherited" | "none"

export interface FamilyRow {
  readonly family: FamilyName
  readonly components: readonly string[]
  /** Allowed `data-variant` values, default first; empty: the family has no variant. */
  readonly variants: readonly Variant[]
  readonly size: SizeMode
  /** Allowed `data-size` values, default `md`; empty unless `size` is `own`. */
  readonly sizes: readonly Size[]
  readonly sizedComponents?: readonly string[]
}

const sizes = ["md", "sm", "lg"] as const // default first

// Several components below do not exist yet: their change adds the stylesheet, the row is here.
export const familyMatrix = [
  {
    family: "action",
    // Triggers styled as buttons use the button's attributes; they have no scope of their own.
    components: ["button", "toggle"],
    variants: ["solid", "soft", "outline", "ghost"],
    size: "own",
    sizes,
  },
  {
    family: "toggle item",
    components: [
      "toggle-group-item",
      "toolbar-button",
      "toolbar-link",
      "toolbar-toggle",
      "menubar-trigger",
      "navigation-menu-trigger",
      "navigation-menu-link",
      "pagination",
    ],
    variants: ["ghost", "soft", "outline"],
    size: "own",
    sizes,
  },
  {
    family: "field",
    components: [
      "text-field",
      "select",
      "combobox",
      "number-input",
      "pin-input",
      "date-field",
      "time-field",
      "date-range-field",
      "time-range-field",
      "date-picker",
      "date-range-picker",
      "color-picker",
      "prompt-input",
      "clipboard",
      "file-upload",
      "angle-slider",
    ],
    variants: ["outline", "soft"],
    size: "own",
    sizes,
  },
  {
    family: "choice",
    components: ["checkbox", "radio", "switch"],
    variants: ["solid", "soft"],
    size: "own",
    sizes,
  },
  {
    family: "selector",
    components: ["tabs-list"],
    variants: ["ghost", "soft"], // ghost: underline, soft: pill
    size: "own",
    sizes,
  },
  {
    family: "selector",
    components: ["segmented-control"],
    variants: ["soft", "outline"],
    size: "own",
    sizes,
  },
  {
    family: "status",
    components: ["badge", "tag-group", "alert", "toast"],
    variants: ["soft", "solid", "outline"],
    size: "own",
    sizes,
  },
  {
    family: "identity",
    components: ["avatar", "avatar-group"],
    variants: ["soft", "solid", "outline"],
    size: "own",
    sizes,
  },
  {
    family: "panel",
    components: [
      "dialog",
      "drawer",
      "popover",
      "menu",
      "hover-card",
      "tooltip",
      "tour",
      "toolbar",
      "menubar",
      "navigation-menu-viewport",
      "navigation-menu-content",
      "calendar",
      "range-calendar",
      "date-picker-content",
      "date-range-picker-content",
      "month-picker",
      "year-picker",
      "color-picker-content",
    ],
    variants: [],
    size: "inherited",
    sizes: [],
    sizedComponents: ["dialog", "drawer"], // width: sm, md, lg
  },
  {
    family: "collection item",
    components: [
      "menu-item",
      "listbox-option",
      "grid-list-item",
      "tree-view-item",
      "calendar-day",
      "range-calendar-day",
      "month-picker-cell",
      "year-picker-cell",
    ],
    variants: [],
    size: "inherited",
    sizes: [],
  },
  {
    family: "link",
    components: ["link", "breadcrumbs-link", "navigation-menu-content-link"],
    variants: [],
    size: "none", // inherits the surrounding font size
    sizes: [],
  },
  {
    family: "range",
    components: ["slider", "progress", "meter", "rating"],
    variants: ["solid", "soft"],
    size: "own",
    sizes,
  },
  {
    // Look via each component's own tokens: --rind-separator-*, --rind-skeleton-*,
    // --rind-image-*, --rind-scroll-area-*, --rind-qr-code-*, --rind-code-block-*,
    // --rind-splitter-*.
    family: "decoration",
    components: [
      "separator",
      "skeleton",
      "image",
      "scroll-area",
      "qr-code",
      "code-block",
      "splitter",
      "table",
      "marquee",
      "streaming-message",
      "message-thread",
      "reasoning",
      "stepper",
      "sortable",
      "image-cropper",
      "image-viewer",
      "table-of-contents",
      "kbd",
      "timeline",
    ],
    variants: [],
    size: "none",
    sizes: [],
  },
] as const satisfies readonly FamilyRow[]

/**
 * Structural components: no family, no `data-variant` rules, only typography and spacing
 * tokens, so an inherited `data-size` scales their text and spacing and nothing else.
 */
export const noFamily = ["label", "field", "fieldset", "form", "heading"] as const

/** The family of a component scope, or `undefined` (structural components, unknown scopes). */
export function familyOf(scope: string): FamilyName | undefined {
  return familyMatrix.find((r) => (r.components as readonly string[]).includes(scope))?.family
}

/** The row of a component scope. */
export function rowOf(scope: string): FamilyRow | undefined {
  return familyMatrix.find((r) => (r.components as readonly string[]).includes(scope))
}

/** Every component scope in the matrix. */
export const allComponents: readonly string[] = familyMatrix.flatMap((r) => r.components)
