import type {
  ChangeDetails,
  Collection,
  ComboboxFilter,
  LoadingStatus,
  MentionRange,
  MentionsEvent,
  MentionsMessages,
  MentionsQuery,
  MentionsSelectDetails,
  MentionTrigger,
  MessageOverrides,
  PositioningProps,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLTextareaAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    mentions: MentionsMessages
  }
}

/** What every part's snippets receive. */
export interface MentionsRenderState {
  readonly open: boolean
  /** The trigger id at the caret, null when closed. */
  readonly trigger: string | null
  /** The text typed after the trigger. */
  readonly query: string
}

type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<MentionsRenderState>]> | undefined
  readonly children?: Snippet<[MentionsRenderState]> | undefined
}

export type MentionsRootProps = Part<Omit<HTMLAttributes<HTMLDivElement>, "onselect">> & {
  /** The text; `bind:value` controls it. */
  value?: string | undefined
  /** Uncontrolled text. Default "". */
  readonly defaultValue?: string | undefined
  /** Every change of the text. */
  readonly onValueChange?:
    | ((value: string, details: ChangeDetails<MentionsEvent>) => void)
    | undefined
  /** The mention ranges; `bind:mentions` controls them. */
  mentions?: readonly MentionRange[] | undefined
  /** Uncontrolled mention ranges. */
  readonly defaultMentions?: readonly MentionRange[] | undefined
  /** Mentions added, moved or removed. */
  readonly onMentionsChange?:
    | ((mentions: readonly MentionRange[], details: ChangeDetails<MentionsEvent>) => void)
    | undefined
  /** `{ char, id?, behavior?: "insert" | "action", startOfInput?, allowSpaces?, appendSpace? }`. */
  readonly triggers: readonly MentionTrigger[]
  /** The options for the current query (default: the Item parts, filtered by the query). */
  readonly items?: Collection<unknown> | undefined
  /** The matcher for the Item parts; `null` lists them unfiltered. */
  readonly filter?: ComboboxFilter | null | undefined
  /** The trigger and query at the caret; null when it closes. */
  readonly onQueryChange?: ((query: MentionsQuery | null) => void) | undefined
  /** An "action" trigger's choice. */
  readonly onSelect?: ((details: MentionsSelectDetails) => void) | undefined
  /** The inserted label (default: the trigger char and the text). */
  readonly formatLabel?:
    | ((item: { readonly key: string; readonly text: string }, trigger: string) => string)
    | undefined
  /** Tab inserts the highlighted option. Default true. */
  readonly selectOnTab?: boolean | undefined
  /** Results are loading. */
  readonly loading?: LoadingStatus | undefined
  /** No editing; the list never opens. */
  readonly readonly?: boolean | undefined
  /** Not editable or submitted. */
  readonly disabled?: boolean | undefined
  /** The list's placement at the trigger (default: below, flipping). */
  readonly positioning?: PositioningProps | undefined
  /** The list stays mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  /** Overrides the strings (also through the provider). */
  readonly messages?: MessageOverrides<MentionsMessages> | undefined
}

export type MentionsTextareaProps = Omit<HTMLTextareaAttributes, "value" | "children">
export type MentionsPartProps = Part<HTMLAttributes<HTMLElement>>
export type MentionsHighlighterProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** A mention's content (default: its label). */
  readonly mention?: Snippet<[{ mention: MentionRange; text: string }]> | undefined
}
