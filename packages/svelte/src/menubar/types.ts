import type { MenubarValueReason } from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"
import type { MenuLevelOptions } from "../menu/types"

/** What `bind:actions` exposes. */
export interface MenubarActions {
  /** Focuses the bar's tab stop (for an application shortcut such as F10). */
  focus(): void
}

export interface MenubarState {
  readonly open: boolean
  readonly orientation: "horizontal" | "vertical"
}

export type MenubarRootProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** The open menu's value, or null; `bind:value` controls it. */
  value?: string | null | undefined
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?:
    | ((
        value: string | null,
        details: { readonly reason: MenubarValueReason; readonly event: unknown },
      ) => void)
    | undefined
  readonly orientation?: "horizontal" | "vertical" | undefined
  /** Arrow moves wrap at both ends (default true). */
  readonly loop?: boolean | undefined
  /** Default true: passed to every menu. */
  readonly modal?: boolean | undefined
  readonly disabled?: boolean | undefined
  /** Disabled items stay focusable and reachable by arrows (default true). */
  readonly focusableWhenDisabled?: boolean | undefined
  /** `bind:actions`: focus. */
  actions?: MenubarActions | undefined
  readonly child?: Snippet<[ChildArgs<MenubarState>]> | undefined
  readonly children?: Snippet<[MenubarState]> | undefined
}
export type MenubarMenuProps = MenuLevelOptions & {
  /** The menu's key in the bar's `value`. */
  readonly value: string
  /** Disables this menu: its trigger never opens it. */
  readonly disabled?: boolean | undefined
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  readonly children?: Snippet | undefined
}
export type MenubarTriggerProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** The typeahead text of the bar item. Default: the text content. */
  readonly textValue?: string | undefined
  readonly child?: Snippet<[ChildArgs<{ readonly open: boolean }>]> | undefined
  readonly children?: Snippet<[{ readonly open: boolean }]> | undefined
}
