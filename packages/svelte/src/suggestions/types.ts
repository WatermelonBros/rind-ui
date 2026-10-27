import type {
  MessageOverrides,
  SuggestionsMessages,
  SuggestionsSelectDetails,
  SuggestionsState,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    suggestions: SuggestionsMessages
  }
}

/** What every part's snippets receive. */
export interface SuggestionsRenderState {
  readonly state: SuggestionsState
  readonly count: number
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<SuggestionsRenderState>]> | undefined
  readonly children?: Snippet<[SuggestionsRenderState]> | undefined
}

// `onSelect` is the suggestion picked, not the DOM `select` event.
export type SuggestionsRootProps = Part<Omit<HTMLAttributes<HTMLDivElement>, "onselect">> & {
  /** A press: put the value in the prompt, or send it. The component does neither. */
  readonly onSelect?: ((details: SuggestionsSelectDetails) => void) | undefined
  /** The items stay, disabled and focusable; the group is busy. */
  readonly loading?: boolean | undefined
  /** No press does anything. */
  readonly disabled?: boolean | undefined
  /** Announce a new set ("3 suggestions"); never on mount. Default "off". */
  readonly announce?: "off" | "polite" | undefined
  /** Where the focus goes after a press that began inside (the prompt). */
  readonly focusTarget?: (() => { focus(): void } | null) | undefined
  readonly messages?: MessageOverrides<SuggestionsMessages> | undefined
  /** Default: the provider's locale. */
  readonly locale?: string | undefined
}
export type SuggestionsItemProps = Part<Omit<HTMLButtonAttributes, "value" | "disabled">> & {
  /** What `onSelect` receives; default: the Label's text (else the item's text). */
  readonly value?: string | undefined
  /** This suggestion does nothing (stays focusable). */
  readonly disabled?: boolean | undefined
}
export type SuggestionsLabelProps = Part<HTMLAttributes<HTMLSpanElement>>
export type SuggestionsDescriptionProps = Part<HTMLAttributes<HTMLSpanElement>>
