// The framework-neutral props `connect` produces for each part. Each adapter's
// `normalizeProps` maps them to its framework.
//
// - Attributes use HTML names: `class`, `for`, `tabindex`, `readonly`, `colspan`, …
// - Handlers are `on` + the DOM event name in camel case: `onClick`, `onKeyDown`,
//   `onPointerDown`, `onDblClick`, `onFocusIn` / `onFocusOut` (bubbling focus), `onInput`.
// - `style` keys are CSS property names in kebab case (`z-index`, `--rind-x`).

/** Attributes a pattern's accessibility depends on; overriding one warns in development. */
export const CRITICAL: unique symbol = Symbol.for("rind-ui.critical")

export type DataAttributes = { readonly [K in `data-${string}`]?: string | undefined }

export interface PartProps extends DataAttributes {
  readonly [CRITICAL]?: readonly string[]
  readonly [key: string]: unknown
}

/** Instance-scoping attributes every part carries, portalled or not. */
export function scopeAttrs(scope: string, part: string, instance: string) {
  return { "data-scope": scope, "data-part": part, "data-instance": instance } as const
}

/**
 * A component rendered as another component's part (a Slider inside a Color Picker): the host's
 * `data-scope` and the host's name for each of its parts. Absent, a component keeps its own.
 */
export interface PartNaming<P extends string = string> {
  readonly scope: string
  readonly part: (name: P) => string
}

/** `data-*` boolean: present and empty when true, absent when false. */
export const dataFlag = (value: boolean): "" | undefined => (value ? "" : undefined)
