import type {
  CollectionKey,
  LinkInput,
  MenuActivation,
  MenuChangeDetails,
  MenuItemKind,
  PositioningProps,
  RouterOptions,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAnchorAttributes, HTMLAttributes, HTMLButtonAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"

/** `onSelect`'s details: `cancel()` keeps the menu open. */
export interface MenuSelectDetails {
  readonly key: CollectionKey
  readonly kind: MenuItemKind
  readonly modality: MenuActivation["modality"]
  cancel(): void
}

export interface MenuOpenState {
  readonly open: boolean
}
export type MenuTriggerState = MenuOpenState
export type MenuContentState = MenuOpenState

export interface MenuItemRenderState {
  readonly highlighted: boolean
  readonly disabled: boolean
}

/** What `bind:actions` exposes. */
export interface MenuActions {
  open(): void
  close(): void
}

type Part<A, S = undefined> = Omit<A, "children" | "onselect"> & {
  readonly child?: Snippet<[ChildArgs<S>]> | undefined
  readonly children?: (S extends undefined ? Snippet : Snippet<[S]>) | undefined
}

export interface MenuLevelOptions {
  /** Arrow navigation wraps from the last item to the first and back. Default: true. */
  readonly loop?: boolean | undefined
  /** Disabled items stay reachable by navigation (they still cannot be activated). Default: true. */
  readonly focusableWhenDisabled?: boolean | undefined
  /** Milliseconds of idle time that end a typeahead search. Default: 1000. */
  readonly typeaheadTimeout?: number | undefined
  /** Side, align, offsets, flip, shift, size, arrow and mode (`manual` for CSS anchor positioning). */
  readonly positioning?: PositioningProps | undefined
  /** Milliseconds the pointer rests on a submenu trigger before it opens. Default: 100. */
  readonly submenuOpenDelay?: number | undefined
  /** Milliseconds the pointer may rest inside the grace area towards an open submenu before it closes. Default: 300. */
  readonly submenuGraceTimeout?: number | undefined
}

export type MenuRootProps = MenuLevelOptions & {
  /** Base for the ids of the menu's parts. Default: generated. */
  readonly id?: string | undefined
  /** Visibility; `bind:open` controls it. */
  open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: MenuChangeDetails) => void) | undefined
  /** Default true: everything outside is inert and an outside press only closes the menu. */
  readonly modal?: boolean | undefined
  /** Positioner and content stay mounted (hidden) while closed. */
  readonly keepMounted?: boolean | undefined
  /** `bind:actions`: open, close. */
  actions?: MenuActions | undefined
  readonly children?: Snippet<[MenuOpenState]> | undefined
}
export type MenuTriggerProps = Part<HTMLButtonAttributes, MenuTriggerState>
export type MenuPositionerProps = Part<HTMLAttributes<HTMLDivElement>>
export type MenuContentProps = Part<HTMLAttributes<HTMLDivElement>, MenuContentState>
export type MenuArrowProps = Part<HTMLAttributes<HTMLDivElement>>

type ItemBase = {
  /** The item's key (default: generated). */
  readonly value?: string | undefined
  /** Typeahead text (default: the text content). */
  readonly textValue?: string | undefined
  readonly disabled?: boolean | undefined
  readonly onSelect?: ((details: MenuSelectDetails) => void) | undefined
}
export type MenuItemProps = Part<HTMLAttributes<HTMLDivElement>, MenuItemRenderState> &
  ItemBase & {
    /** Default true: activating the item closes the menu tree. */
    readonly closeOnSelect?: boolean | undefined
    /** A link item (rendered as `<a>`). */
    readonly href?: LinkInput["href"] | undefined
    /** The link's `target`; a target other than `_self` leaves navigation to the browser. */
    readonly target?: HTMLAnchorAttributes["target"] | undefined
    /** The link's `rel`. */
    readonly rel?: string | undefined
    /** The link's `download`: `true` or a file name; the browser downloads instead of navigating. */
    readonly download?: boolean | string | undefined
    /** Passed unchanged to the router's `navigate`. */
    readonly routerOptions?: RouterOptions | undefined
  }
export type MenuCheckboxItemProps = Part<HTMLAttributes<HTMLDivElement>, MenuItemRenderState> &
  ItemBase & {
    /** Checked state; `bind:checked` controls it. */
    checked?: boolean | undefined
    /** Initial checked state while uncontrolled. Default: false. */
    readonly defaultChecked?: boolean | undefined
    /** Called with the new checked state each time the item is toggled. */
    readonly onCheckedChange?: ((checked: boolean) => void) | undefined
    /** Default false: the menu stays open while options are toggled. */
    readonly closeOnSelect?: boolean | undefined
  }
export type MenuRadioGroupProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Selected value; `bind:value` controls it. */
  value?: string | null | undefined
  /** Initial selected value while uncontrolled. Default: null. */
  readonly defaultValue?: string | null | undefined
  readonly onValueChange?: ((value: string | null) => void) | undefined
  readonly disabled?: boolean | undefined
}
export type MenuRadioItemProps = Part<HTMLAttributes<HTMLDivElement>, MenuItemRenderState> &
  Omit<ItemBase, "value"> & {
    readonly value: string
    /** Default false. */
    readonly closeOnSelect?: boolean | undefined
  }
export type MenuItemIndicatorProps = Part<HTMLAttributes<HTMLSpanElement>> & {
  /** Rendered while unchecked too (hidden by CSS on `data-state`). */
  readonly keepMounted?: boolean | undefined
}
export type MenuItemTextProps = Part<HTMLAttributes<HTMLSpanElement>>
export type MenuGroupProps = Part<HTMLAttributes<HTMLDivElement>>
export type MenuSeparatorProps = Part<HTMLAttributes<HTMLDivElement>> & {
  /** Default: perpendicular to the menu (horizontal in a vertical menu). */
  readonly orientation?: "horizontal" | "vertical" | undefined
}
export type MenuSubmenuProps = MenuLevelOptions & {
  readonly children?: Snippet | undefined
}
export type MenuSubmenuTriggerProps = Part<HTMLAttributes<HTMLDivElement>, MenuItemRenderState> & {
  readonly textValue?: string | undefined
  readonly disabled?: boolean | undefined
}
