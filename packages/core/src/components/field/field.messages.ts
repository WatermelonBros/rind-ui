import type { ValidityKey } from "../../dom/constraint-validity"

/**
 * The Field's messages. `errorAnnouncement` is what the announcer speaks; `invalid` is the
 * native validity message while the `invalid` prop forces an error with no message; one
 * optional override per validity key (default: the browser's `validationMessage`).
 */
export type FieldMessages = {
  readonly errorAnnouncement: (label: string, message: string) => string
  readonly invalid: string
} & { readonly [K in ValidityKey]?: string }

export const fieldMessages: FieldMessages = {
  errorAnnouncement: (label, message) => (label ? `${label}: ${message}` : message),
  invalid: "Invalid value",
}
