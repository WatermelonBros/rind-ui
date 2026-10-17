// Search Field (design §1): a Text Field preset with two keys. Escape clears through the
// ClearTrigger's path and is consumed only when it cleared something, so an enclosing layer
// closes on an empty field (react-spectrum#5480). Enter searches and never prevents the
// form's implicit submission. Neither acts while an IME composes.

import { buildTextFieldMachine } from "../text-field/text-field.machine"

/** The native key event, as far as the machine touches it. */
export interface SearchFieldKey {
  preventDefault(): void
  stopPropagation(): void
}

export type SearchFieldEvent =
  | { readonly type: "ESCAPE"; readonly event: SearchFieldKey; readonly composing: boolean }
  | { readonly type: "SUBMIT"; readonly event: SearchFieldKey; readonly composing: boolean }

export interface SearchFieldSubmitDetails {
  /** The Enter key event: `preventDefault()` stops the form's implicit submission. */
  readonly event: SearchFieldKey
}

export interface SearchFieldOwnProps {
  readonly onSubmit?: ((value: string, details: SearchFieldSubmitDetails) => void) | undefined
}

export const { machine: searchFieldMachine } = buildTextFieldMachine<{
  props: SearchFieldOwnProps
  events: SearchFieldEvent
}>({
  scope: "search-field",
  events: {
    ESCAPE: {
      guard: { and: ["notComposing", "hasValue", "editable"] },
      actions: ["consumeKey", "clearOnEscape"],
    },
    SUBMIT: { guard: "notComposing", actions: ["callOnSubmit"] },
  },
  guards: {
    // Safari reports the commit Enter after compositionend: the key says it still composes.
    notComposing: ({ event }) =>
      !((event.type === "ESCAPE" || event.type === "SUBMIT") && event.composing),
    hasValue: ({ values }) => values.value !== "",
  },
  actions: {
    // Only a taken transition consumes the key; otherwise it reaches the enclosing layer.
    consumeKey: ({ event }) => {
      if (event.type !== "ESCAPE") return
      event.event.preventDefault()
      event.event.stopPropagation()
    },
    clearOnEscape: ({ props }) => props.clearInput("ESCAPE", true),
    callOnSubmit: ({ event, props, values }) => {
      if (event.type === "SUBMIT") props.onSubmit?.(values.value, { event: event.event })
    },
  },
})
export type SearchFieldMachine = typeof searchFieldMachine
