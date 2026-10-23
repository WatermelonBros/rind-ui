import type { SeparatorOrientation } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ButtonProps } from "../button/types"
import type { ChildArgs } from "../child"
import type { LinkProps } from "../link/types"

/** What `bind:this` on the Root exposes. */
export interface ToolbarActions {
  /** Focuses the toolbar's tab stop (for an application shortcut such as Alt+F10). */
  focus(): void
}
export interface ToolbarState {
  readonly orientation: "horizontal" | "vertical"
  readonly disabled: boolean
}
export interface ToolbarItemState {
  readonly disabled: boolean
}
export interface ToolbarGroupState {
  readonly disabled: boolean
}
type Part<A, S> = Omit<A, "children"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: Snippet<[S]> | undefined
}
export type ToolbarRootProps = Part<HTMLAttributes<HTMLDivElement>, ToolbarState> & {
  readonly orientation?: "horizontal" | "vertical" | undefined
  /** Arrow moves wrap at both ends (default true). */
  readonly loop?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Disabled controls stay focusable and reachable by arrows (default true). */
  readonly focusableWhenDisabled?: boolean | undefined
}
export type ToolbarButtonProps = ButtonProps
export type ToolbarLinkProps = LinkProps
export type ToolbarItemProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  /** Disables this control (the toolbar's or its group's `disabled` also does). */
  readonly disabled?: boolean | undefined
  /** Overrides the toolbar's `focusableWhenDisabled` for this control. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** The control: another component's part (a Menu trigger), a checkbox, a text input. */
  readonly child: Snippet<[ChildArgs<ToolbarItemState>]>
}
export type ToolbarGroupProps = Part<HTMLAttributes<HTMLDivElement>, ToolbarGroupState> & {
  /** Disables every control inside the group. */
  readonly disabled?: boolean | undefined
}
export type ToolbarSeparatorProps = Part<
  HTMLAttributes<HTMLDivElement>,
  { readonly orientation: SeparatorOrientation }
> & {
  /** Default: perpendicular to the toolbar. */
  readonly orientation?: SeparatorOrientation | undefined
}
