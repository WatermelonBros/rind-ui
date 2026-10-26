// Suggestions (add-suggestions design §1): ready, loading, disabled from the props. A press
// only calls onSelect (no built-in send: assistant-ui's flags fork code paths); a new set is
// announced only when asked, never on mount and never through a live region.

import type { AnnouncerEnv, LocaleEnv } from "../../env/capabilities"
import { setup, type } from "../../machine/setup"
import { type SuggestionsMessages, suggestionsMessages } from "./suggestions.messages"

export type SuggestionsState = "ready" | "loading" | "disabled"

export interface SuggestionsSelectDetails {
  readonly value: string
  readonly index: number
  readonly key: string
}

export type SuggestionsEvent =
  | {
      readonly type: "PRESS"
      readonly key: string
      readonly value: string
      readonly index: number
      readonly itemDisabled: boolean
      /** The focus was inside the Root when the press began. */
      readonly focusWasInside: boolean
    }
  /** The rendered items' keys, reported by the Root when they change. */
  | { readonly type: "ITEMS"; readonly keys: readonly string[] }
  | { readonly type: "SYNC" }

export interface SuggestionsProps {
  readonly loading?: boolean | undefined
  readonly disabled?: boolean | undefined
  readonly announce?: "off" | "polite" | undefined
  readonly onSelect?: ((details: SuggestionsSelectDetails) => void) | undefined
  /** Where the focus goes after a press that began inside (the prompt). */
  readonly focusTarget?: (() => { focus(): void } | null) | undefined
  readonly messages?: SuggestionsMessages | undefined
  readonly id: string
  readonly lang?: string | undefined
}

export interface SuggestionsContext {
  /** The keys last reported; null before the first report. */
  readonly keys: readonly string[] | null
}

const stateOf = (p: SuggestionsProps): SuggestionsState =>
  p.disabled === true ? "disabled" : p.loading === true ? "loading" : "ready"

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((k, i) => k === b[i])

export const suggestionsMachine = /* @__PURE__ */ setup({
  types: type<{
    props: SuggestionsProps
    events: SuggestionsEvent
    env: AnnouncerEnv & LocaleEnv
    context: SuggestionsContext
  }>(),
  guards: {
    pressable: ({ event }) => event.type === "PRESS" && !event.itemDisabled,
    isLoading: ({ props }) => stateOf(props) === "loading",
    isDisabled: ({ props }) => stateOf(props) === "disabled",
  },
  actions: {
    select: ({ event, props }) => {
      if (event.type !== "PRESS") return
      props.onSelect?.({ value: event.value, index: event.index, key: event.key })
      if (event.focusWasInside) props.focusTarget?.()?.focus()
    },
    recordItems: ({ context, env, event, props, set }) => {
      if (event.type !== "ITEMS") return
      const was = context.keys
      set("keys", event.keys)
      if (was === null || same(was, event.keys) || props.announce !== "polite") return
      env.announcer.announce({
        message: (props.messages ?? suggestionsMessages).count(event.keys.length),
        priority: "polite",
        key: `suggestions-${props.id}`,
        lang: props.lang ?? env.locale.locale(),
      })
    },
  },
  effects: {
    prepareAnnouncer: ({ env }) => env.announcer.prepare(),
    /** The props' state from the start (`loading` or `disabled` on mount). */
    syncInitial: ({ send }) => {
      send({ type: "SYNC" })
      return undefined
    },
  },
}).machine({
  id: "suggestions",
  initial: "ready",
  context: () => ({ keys: null }),
  effects: ["prepareAnnouncer", "syncInitial"],
  onProps: { loading: "SYNC", disabled: "SYNC" },
  on: {
    ITEMS: { actions: ["recordItems"] },
    SYNC: [
      { guard: "isDisabled", target: "disabled" },
      { guard: "isLoading", target: "loading" },
      { target: "ready" },
    ],
  },
  states: {
    ready: { on: { PRESS: { guard: "pressable", actions: ["select"] } } },
    loading: {},
    disabled: {},
  },
})

export type SuggestionsMachine = typeof suggestionsMachine
