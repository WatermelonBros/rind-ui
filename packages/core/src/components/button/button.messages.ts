/** Button's messages (English defaults), overridable per instance and through the provider. */
export const buttonMessages = {
  /** Announced once when a focused Button becomes pending. */
  pending: "Loading",
} as const satisfies Record<string, string>

export type ButtonMessages = { readonly pending: string }
