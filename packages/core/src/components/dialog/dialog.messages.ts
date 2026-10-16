/** Dialog's messages (English defaults), overridable per instance and through the provider. */
export const dialogMessages = {
  /** The name of a close trigger that renders no content of its own. */
  close: "Close",
} as const satisfies Record<string, string>

export type DialogMessages = { readonly close: string }
