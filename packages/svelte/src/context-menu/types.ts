import type {
  ContextMenuMessages,
  MenuAnchorDetails,
  MenuChangeDetails,
  MenuPoint,
  MessageOverrides,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "../child"
import type { MenuLevelOptions } from "../menu/types"

declare module "../provider" {
  interface RindMessageScopes {
    "context-menu": ContextMenuMessages
  }
}

/** `onOpenChange`'s details, with where and on what the opening gesture happened. */
export type ContextMenuChangeDetails = MenuChangeDetails & {
  readonly point: MenuPoint | null
  readonly target: Element | null
  readonly nativeEvent: Event | null
}

/** What `bind:actions` exposes. */
export interface ContextMenuActions {
  /** Opens it at `point` (viewport coordinates), for `target` (e.g. a document listener). */
  openAt(point: MenuPoint, target?: Element | null): void
  close(): void
}

export interface ContextMenuTriggerState {
  readonly open: boolean
}

export type ContextMenuRootProps = MenuLevelOptions & {
  /** Base for the ids of the menu's parts. Default: generated. */
  readonly id?: string | undefined
  /** Visibility; `bind:open` controls it. */
  open?: boolean | undefined
  readonly defaultOpen?: boolean | undefined
  readonly onOpenChange?: ((open: boolean, details: ContextMenuChangeDetails) => void) | undefined
  /** A second gesture in the same region moved the open menu. */
  readonly onAnchorChange?: ((details: MenuAnchorDetails) => void) | undefined
  /** Default true. */
  readonly modal?: boolean | undefined
  /** The browser's own menu shows instead. */
  readonly disabled?: boolean | undefined
  /** Default true: a touch or pen held on the region opens it. */
  readonly longPress?: boolean | undefined
  /** Default 500 ms. */
  readonly longPressDelay?: number | undefined
  readonly keepMounted?: boolean | undefined
  readonly messages?: MessageOverrides<ContextMenuMessages> | undefined
  /** `bind:actions`: openAt, close. */
  actions?: ContextMenuActions | undefined
  readonly children?: Snippet<[{ readonly open: boolean }]> | undefined
}
export type ContextMenuTriggerProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<ContextMenuTriggerState>]> | undefined
  readonly children?: Snippet<[ContextMenuTriggerState]> | undefined
}
