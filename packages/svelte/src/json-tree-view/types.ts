import type { JsonTreeViewMessages, MessageOverrides } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type {
  TreeViewExpandedDetails,
  TreeViewItemProps,
  TreeViewRootProps,
} from "../tree-view/types"

declare module "../provider" {
  interface RindMessageScopes {
    "json-tree-view": JsonTreeViewMessages
  }
}

export type JsonCopyFormat = "json" | "value" | "pointer"
export type JsonCopyState = "idle" | "copying" | "copied" | "error"

/** What a snippet child of the Root receives. */
export interface JsonTreeViewApi {
  readonly copyState: JsonCopyState
  /**
   * Expands every container down to `depth` levels (default: one deeper than the deepest open
   * one), stopping before 5000 rows would be visible.
   */
  readonly expandAll: (options?: { readonly depth?: number | undefined }) => void
  /** Copies the highlighted item in `copyFormat` through the clipboard. */
  readonly copy: () => void
}

export type JsonTreeViewRootProps = Omit<
  TreeViewRootProps,
  | "items"
  | "collection"
  | "children"
  | "id"
  | "messages"
  | "expandedValue"
  | "onLoadChildren"
  | "movable"
  | "onMove"
> & {
  /** The value to show. */
  readonly data: unknown
  /** Levels open on the first value; a new `data` keeps the user's expansion. Default 1. */
  readonly defaultExpandedDepth?: number | undefined
  /** More children than this are grouped in ranges. Default 100. */
  readonly groupSize?: number | undefined
  /** Keys previewed after a collapsed container. Default 3. */
  readonly maxPreviewItems?: number | undefined
  /** What a copy writes: the subtree as JSON (default), a leaf's raw value, or the pointer. */
  readonly copyFormat?: JsonCopyFormat | undefined
  /** How long `copied` / `error` last before `idle` (ms). Default 2000. */
  readonly copyFeedbackDuration?: number | undefined
  /** The expanded containers' keys; `bind:expandedValue` controls them. */
  expandedValue?: readonly string[] | undefined
  readonly onExpandedChange?:
    | ((keys: readonly string[], details: TreeViewExpandedDetails) => void)
    | undefined
  readonly messages?: MessageOverrides<JsonTreeViewMessages> | undefined
  /** Default: the provider's locale (the copy announcements' language). */
  readonly locale?: string | undefined
  readonly id?: string | undefined
  readonly class?: string | undefined
  readonly style?: string | undefined
  readonly "aria-label"?: string | undefined
  readonly "aria-labelledby"?: string | undefined
  /** Custom markup (Tree View parts and the JSON parts); default: the whole tree. */
  readonly children?: Snippet<[JsonTreeViewApi]> | undefined
}
export type JsonTreeViewItemProps = TreeViewItemProps
export type JsonTreeViewPartProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  readonly children?: Snippet | undefined
}
export type JsonTreeViewCopyTriggerProps = Omit<HTMLButtonAttributes, "children"> & {
  readonly children?: Snippet | undefined
}
