import type {
  Collection,
  TagGroupActionDetails,
  TagGroupMessages,
  TagGroupRemoveDetails,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

/** One tag of a data-driven group. */
export interface TagGroupItemData {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  /** A link tag: its text renders as an anchor. */
  readonly href?: string
}
export interface TagGroupChangeDetails {
  readonly reason: string
  readonly key: string | undefined
}
type Part<A> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
export type TagGroupRootProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** `none` (default), `single` or `multiple`. */
  readonly selectionMode?: "none" | "single" | "multiple" | undefined
  /** The selection: a key or null (single), keys (multiple); `bind:value` controls it. */
  value?: string | readonly string[] | null | undefined
  readonly defaultValue?: string | readonly string[] | null | undefined
  readonly onValueChange?:
    | ((value: string | readonly string[] | null, details: TagGroupChangeDetails) => void)
    | undefined
  /** No user action leaves the selection empty. */
  readonly disallowEmptySelection?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Disabled tags stay reachable (announced as dimmed). Default true. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Arrow keys wrap around. Default true. */
  readonly loop?: boolean | undefined
  /** How long typed characters build one typeahead search (ms). Default: 1000. */
  readonly typeaheadTimeout?: number | undefined
  /** Data tags. Without them (and without `collection`), Tag parts register themselves. */
  readonly items?: readonly TagGroupItemData[] | undefined
  /** A collection built by the consumer, used instead of `items`. */
  readonly collection?: Collection<unknown> | undefined
  /** Tags are removable: drop the keys from your data, or keep them (nothing happens). */
  readonly onRemove?:
    | ((keys: readonly string[], details: TagGroupRemoveDetails) => void)
    | undefined
  readonly onAction?: ((key: string, details: TagGroupActionDetails) => void) | undefined
  readonly messages?: Partial<TagGroupMessages> | undefined
}
export type TagGroupSpanProps = Part<HTMLAttributes<HTMLSpanElement>>
export type TagGroupDivProps = Part<HTMLAttributes<HTMLDivElement>>
export type TagGroupTagProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** The tag key. */
  readonly value: string
  /** The tag's text for typeahead and the remove button's name. */
  readonly textValue?: string | undefined
  /** Disables this tag: it cannot be selected or removed. */
  readonly disabled?: boolean | undefined
  /** A link tag: TagText renders an anchor to it. */
  readonly href?: string | undefined
}
export type TagGroupTagRemoveProps = Part<HTMLButtonAttributes>
export interface TagGroupTagsProps {
  /** Renders one tag's content from its label and key; default: TagText and TagRemove. */
  readonly children?: Snippet<[{ label: string; key: string }]> | undefined
}
