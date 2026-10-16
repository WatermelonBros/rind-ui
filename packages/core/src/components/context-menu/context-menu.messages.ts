/** Context Menu's messages (English defaults), overridable per instance and the provider. */
export const contextMenuMessages = {
  /** Describes a focusable region that opens a menu on long press. */
  longPressHint: "Long press for more options",
} as const satisfies Record<string, string>

export type ContextMenuMessages = { readonly longPressHint: string }
