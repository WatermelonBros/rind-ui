import type { ChangeDetails, InactivePanels, TabsEvent } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

export interface TabsState {
  readonly value: string | null
  readonly orientation: "horizontal" | "vertical"
}
export interface TabsTabState {
  readonly selected: boolean
  readonly disabled: boolean
}
type Part<A, S> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: Snippet<[S]> | undefined
}
export type TabsRootProps = Part<
  Omit<HTMLAttributes<HTMLDivElement>, "defaultValue">,
  TabsState
> & {
  /** The selected tab; `bind:value` controls it; `null` selects none. */
  value?: string | null | undefined
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?:
    | ((value: string | null, details: ChangeDetails<TabsEvent>) => void)
    | undefined
  /** `automatic` (default): arrows select; `manual`: Enter or Space selects. */
  readonly activationMode?: "automatic" | "manual" | undefined
  readonly orientation?: "horizontal" | "vertical" | undefined
  /** Arrow moves wrap at both ends (default true). */
  readonly loop?: boolean | undefined
  /** How inactive panels are hidden (default `unmount`). */
  readonly inactivePanels?: InactivePanels | undefined
  readonly disabled?: boolean | undefined
  /** Disabled tabs stay reachable by arrows (never selectable). */
  readonly focusableWhenDisabled?: boolean | undefined
}
export type TabsListProps = Part<HTMLAttributes<HTMLDivElement>, TabsState>
export type TabsTabProps = Part<Omit<HTMLButtonAttributes, "value">, TabsTabState> & {
  /** The key pairing this tab with its panel. */
  readonly value: string
  /** Disables this tab: it is never selected. */
  readonly disabled?: boolean | undefined
  /** The text for the collection (defaults to the tab's text content). */
  readonly textValue?: string | undefined
}
export type TabsPanelProps = Part<
  HTMLAttributes<HTMLDivElement>,
  { readonly selected: boolean }
> & {
  /** The key of the tab this panel belongs to. */
  readonly value: string
}
export type TabsIndicatorProps = Part<
  HTMLAttributes<HTMLSpanElement>,
  { readonly visible: boolean }
>
