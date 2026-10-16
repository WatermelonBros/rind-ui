// Pagination (design §1): one state, `idle`; the page and the page size are controllables
// and every event is a guarded self-loop, so `testMachine` covers it through argument
// classes. The resolved page is clamped at view time (`paginationState`), so a render never
// shows a page outside the total even before `COUNT.CHANGE` is processed.

import type { Modality } from "../../a11y/events"
import { setup, type } from "../../machine/setup"
import type { ChangeDetails } from "../../machine/types"

export type PaginationEvent =
  | { readonly type: "SET_PAGE"; readonly page: number; readonly modality: Modality }
  | { readonly type: "PREV" | "NEXT" | "FIRST" | "LAST"; readonly modality: Modality }
  /** Without `pageSize`: sent by onProps when a controlled `pageSize` changed. */
  | { readonly type: "SET_PAGE_SIZE"; readonly pageSize?: number }
  /** onProps: the total changed; clamps a page that is now past the end. */
  | { readonly type: "COUNT.CHANGE" }

export type PaginationChangeDetails = ChangeDetails<PaginationEvent>

/**
 * The machine's props, flat: the React part narrows them to the union where `totalPages`
 * and `count` + `pageSize` exclude each other (spec "Total Pages").
 */
export interface PaginationMachineProps {
  readonly totalPages?: number | undefined
  readonly count?: number | undefined
  readonly page?: number | undefined
  readonly defaultPage?: number | undefined
  readonly onPageChange?: ((page: number, details: PaginationChangeDetails) => void) | undefined
  readonly pageSize?: number | undefined
  readonly defaultPageSize?: number | undefined
  readonly onPageSizeChange?:
    | ((pageSize: number, details: PaginationChangeDetails) => void)
    | undefined
  readonly siblingCount?: number | undefined
  readonly boundaryCount?: number | undefined
  readonly disabled?: boolean | undefined
}

/** A non-negative integer: the floor of the input clamped to 0 (spec "Total Pages"). */
export const wholeNumber = (n: number | undefined, fallback: number): number =>
  n === undefined || !Number.isFinite(n) ? fallback : Math.max(0, Math.floor(n))

/** `totalPages`, or `ceil(count / pageSize)`; never less than 1. */
export function totalPagesOf(props: PaginationMachineProps, pageSize: number): number {
  const total =
    props.totalPages !== undefined
      ? wholeNumber(props.totalPages, 1)
      : Math.ceil(wholeNumber(props.count, 0) / Math.max(1, wholeNumber(pageSize, 10)))
  return Math.max(1, total)
}

const clamp = (n: number, total: number) => Math.min(Math.max(1, Math.floor(n)), total)

type Args = {
  readonly props: PaginationMachineProps
  readonly values: { readonly page: number; readonly pageSize: number }
}
const total = ({ props, values }: Args) => totalPagesOf(props, values.pageSize)
/** The page the view shows: the stored one clamped to the current total. */
const resolved = (a: Args) => clamp(a.values.page, total(a))

export const paginationMachine = setup({
  types: type<{
    props: PaginationMachineProps
    events: PaginationEvent
    env: object
    /** The page size the current page was computed with (to move the page on a change). */
    context: { size: number }
    values: "page" | "pageSize"
  }>(),
  guards: {
    enabled: ({ props }) => props.disabled !== true,
    /** A page in range other than the current one (activating the current page does nothing). */
    otherPage: (a) =>
      a.event.type === "SET_PAGE" &&
      a.event.page >= 1 &&
      a.event.page <= total(a) &&
      a.event.page !== resolved(a),
    hasPrev: (a) => resolved(a) > 1,
    hasNext: (a) => resolved(a) < total(a),
    outOfRange: (a) => a.values.page > total(a),
  },
  actions: {
    setPage: ({ event, set }) => {
      if (event.type === "SET_PAGE") set("page", Math.floor(event.page))
    },
    step: (a) => {
      if (a.event.type === "PREV" || a.event.type === "NEXT") {
        a.set("page", resolved(a) + (a.event.type === "NEXT" ? 1 : -1))
      }
    },
    toEnd: (a) => a.set("page", a.event.type === "FIRST" ? 1 : total(a)),
    /**
     * Keeps the first item of the current page visible (spec "Page Size"): from a control
     * (`pageSize` given) or from the parent's new controlled `pageSize` (onProps), measured
     * against the size the current page was computed with.
     */
    setPageSize: (a) => {
      const { event, context, props, values, set } = a
      if (event.type !== "SET_PAGE_SIZE") return
      const from = context.size
      const size =
        event.pageSize === undefined
          ? Math.max(1, values.pageSize)
          : Math.max(1, wholeNumber(event.pageSize, from))
      if (size === from) return
      const page = clamp(values.page, totalPagesOf(props, from))
      set("size", size)
      if (event.pageSize !== undefined) set("pageSize", size)
      set("page", Math.min(Math.floor(((page - 1) * from) / size) + 1, totalPagesOf(props, size)))
    },
    clampPage: (a) => a.set("page", total(a)),
  },
}).machine({
  id: "pagination",
  initial: "idle",
  context: (props) => ({ size: Math.max(1, props.pageSize ?? props.defaultPageSize ?? 10) }),
  values: { page: { fallback: 1 }, pageSize: { fallback: 10 } },
  onProps: { count: "COUNT.CHANGE", totalPages: "COUNT.CHANGE", pageSize: "SET_PAGE_SIZE" },
  states: {
    idle: {
      on: {
        SET_PAGE: { guard: { and: ["enabled", "otherPage"] }, actions: ["setPage"] },
        PREV: { guard: { and: ["enabled", "hasPrev"] }, actions: ["step"] },
        NEXT: { guard: { and: ["enabled", "hasNext"] }, actions: ["step"] },
        FIRST: { guard: { and: ["enabled", "hasPrev"] }, actions: ["toEnd"] },
        LAST: { guard: { and: ["enabled", "hasNext"] }, actions: ["toEnd"] },
        SET_PAGE_SIZE: { actions: ["setPageSize"] },
        "COUNT.CHANGE": { guard: "outOfRange", actions: ["clampPage"] },
      },
    },
  },
})

export type PaginationMachine = typeof paginationMachine

/** What a view shows: the clamped page, the total and the 1-based item range. */
export interface PaginationState {
  readonly page: number
  readonly pageSize: number
  readonly totalPages: number
  /** 1-based inclusive item indices of the current page (`{ start: 0, end: 0 }` when empty). */
  readonly range: { readonly start: number; readonly end: number }
}

export function paginationState(
  props: PaginationMachineProps,
  values: { readonly page: number; readonly pageSize: number },
): PaginationState {
  const totalPages = totalPagesOf(props, values.pageSize)
  const page = clamp(values.page, totalPages)
  const count = props.count === undefined ? undefined : wholeNumber(props.count, 0)
  const start = count === undefined || count > 0 ? (page - 1) * values.pageSize + 1 : 0
  const end = count === undefined ? page * values.pageSize : Math.min(page * values.pageSize, count)
  return { page, pageSize: values.pageSize, totalPages, range: { start, end } }
}
