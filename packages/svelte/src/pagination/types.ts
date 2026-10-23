import type {
  MessageOverrides,
  PaginationChangeDetails,
  PaginationEntry,
  PaginationMessages,
  PaginationState,
} from "@rind-ui/core"
import type { Snippet } from "svelte"
import type { HTMLAttributes, HTMLLiAttributes } from "svelte/elements"
import type { ButtonProps } from "../button/types"
import type { ChildArgs } from "../child"

declare module "../provider" {
  interface RindMessageScopes {
    pagination: PaginationMessages
  }
}

/** Root's render state (spec "Anatomy"). */
export interface PaginationRootState extends PaginationState {
  /** The visible range: pages and ellipses with stable keys. */
  readonly pages: readonly PaginationEntry[]
  /** Goes to a page (reason `SET_PAGE`), e.g. from a "go to page" field. */
  readonly setPage: (page: number) => void
  /** For a page-size control: keeps the first item of the current page visible. */
  readonly setPageSize: (pageSize: number) => void
}

/** `totalPages`, or `count` with a page size: never both (spec "Total Pages"). */
export type PaginationTotal =
  | {
      readonly totalPages: number
      readonly count?: never
      pageSize?: never
      readonly defaultPageSize?: never
    }
  | {
      readonly count: number
      readonly totalPages?: never
      pageSize?: number | undefined
      readonly defaultPageSize?: number | undefined
    }

export type PaginationRootProps = Omit<HTMLAttributes<HTMLElement>, "children"> &
  PaginationTotal & {
    /** The current page; `bind:page` controls it. */
    page?: number | undefined
    readonly defaultPage?: number | undefined
    readonly onPageChange?: ((page: number, details: PaginationChangeDetails) => void) | undefined
    readonly onPageSizeChange?:
      | ((pageSize: number, details: PaginationChangeDetails) => void)
      | undefined
    readonly siblingCount?: number | undefined
    readonly boundaryCount?: number | undefined
    /** Every control ignores activation (disable while loading). */
    readonly disabled?: boolean | undefined
    /** Default `true`: unavailable controls keep focus (`aria-disabled`). */
    readonly focusableWhenDisabled?: boolean | undefined
    /** Renders links instead of buttons (spec "Buttons And Links"). */
    readonly getPageHref?: ((page: number, pageSize: number) => string) | undefined
    readonly messages?: MessageOverrides<PaginationMessages> | undefined
    readonly child?: Snippet<[ChildArgs<PaginationRootState>]> | undefined
    /** The parts, given the state (to map `pages`). */
    readonly children?: Snippet<[PaginationRootState]> | undefined
  }
export type PaginationListProps = Omit<HTMLAttributes<HTMLUListElement>, "children"> & {
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
export type PaginationItemProps = Omit<HTMLLiAttributes, "children"> & {
  /** What the item holds (`data-type`). Default `"page"`. */
  readonly type?: "page" | "ellipsis" | "trigger" | undefined
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
export type PaginationControlProps = Omit<
  ButtonProps,
  "disabled" | "focusableWhenDisabled" | "onPress" | "type" | "messages" | "pending"
> & {
  /** Default: the Root's (`true`). */
  readonly focusableWhenDisabled?: boolean | undefined
}
export type PaginationPageProps = PaginationControlProps & {
  /** The page number it goes to; `aria-current="page"` when it is the current page. */
  readonly value: number
}
export type PaginationEllipsisProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** Which gap it stands for, before or after the current page (`data-position`). Default: "end". */
  readonly position?: "start" | "end" | undefined
  readonly child?: Snippet<[ChildArgs<undefined>]> | undefined
  readonly children?: Snippet | undefined
}
