// Pagination's parts (design §3). The controls themselves are Button-like elements or
// links (the React parts render Button and Link, which own press, focus and link
// semantics); connect adds what is Pagination's: the landmark name, `aria-current`, the
// controls' names from messages and the `data-*` table of spec "Data Attributes".

import { dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { PaginationState } from "./pagination.machine"
import type { PaginationMessages } from "./pagination.messages"
import { type PaginationEntry, paginationRange } from "./pagination.range"

declare const process: { env: { NODE_ENV?: string } }

export type PaginationDirection = "first" | "previous" | "next" | "last"

export interface PaginationConnectInput {
  readonly instance: string
  readonly state: PaginationState
  readonly messages: PaginationMessages
  readonly disabled?: boolean | undefined
  readonly siblingCount?: number | undefined
  readonly boundaryCount?: number | undefined
}

/** A control's props plus whether it is unavailable (for Button's / Link's `disabled`). */
export interface PaginationControl {
  readonly props: PartProps
  readonly disabled: boolean
}

export function paginationConnect(input: PaginationConnectInput) {
  const { instance, state, messages } = input
  const disabled = input.disabled === true
  const unavailable = (d: PaginationDirection) =>
    disabled ||
    (d === "first" || d === "previous" ? state.page <= 1 : state.page >= state.totalPages)
  return {
    /** The visible range (spec "Visible Range"). */
    pages: (): readonly PaginationEntry[] =>
      paginationRange({
        page: state.page,
        totalPages: state.totalPages,
        siblingCount: input.siblingCount,
        boundaryCount: input.boundaryCount,
      }),
    /** `labelled`: the consumer passed `aria-label` or `aria-labelledby`. */
    root: (labelled: boolean): PartProps => ({
      ...scopeAttrs("pagination", "root", instance),
      "aria-label": labelled ? undefined : messages.label,
      "data-disabled": dataFlag(disabled),
    }),
    list: (): PartProps => scopeAttrs("pagination", "list", instance),
    item: (type: "page" | "ellipsis" | "trigger"): PartProps => ({
      ...scopeAttrs("pagination", "item", instance),
      "data-type": type,
    }),
    /** `labelled`: the consumer named the page itself. */
    page: (value: number, labelled: boolean): PaginationControl => {
      const current = value === state.page
      return {
        disabled,
        props: {
          ...scopeAttrs("pagination", "page", instance),
          "aria-current": current ? "page" : undefined,
          "aria-label": labelled ? undefined : messages.page(value),
          "data-value": String(value),
          "data-current": dataFlag(current),
          "data-disabled": dataFlag(disabled),
        },
      }
    },
    /** `named`: the trigger has text content or a label of its own. */
    trigger: (direction: PaginationDirection, named: boolean): PaginationControl => {
      const off = unavailable(direction)
      return {
        disabled: off,
        props: {
          ...scopeAttrs("pagination", direction, instance),
          "aria-label": named ? undefined : messages[direction],
          "data-direction": direction,
          "data-disabled": dataFlag(off),
        },
      }
    },
    /** Only the glyph: hidden, no role, never focusable. */
    ellipsis: (position: "start" | "end"): PartProps => ({
      ...scopeAttrs("pagination", "ellipsis", instance),
      "aria-hidden": "true",
      "data-position": position,
    }),
  }
}

const dev = () => process.env.NODE_ENV !== "production"
const warn = (message: string) => console.warn(`[rind-ui] pagination: ${message}`)

/** Development: inputs that are not non-negative integers (spec "Total Pages"). */
export function warnPaginationInputs(props: {
  readonly totalPages?: number | undefined
  readonly count?: number | undefined
  readonly pageSize?: number | undefined
  readonly siblingCount?: number | undefined
  readonly boundaryCount?: number | undefined
}): void {
  if (!dev()) return
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "number" && (!Number.isInteger(value) || value < 0)) {
      warn(`${key} ${value} is not a non-negative integer; using ${Math.max(0, Math.floor(value))}`)
    }
  }
}

/** Development: a controlled value without its change handler (ark#3724). */
export function warnControlledWithoutHandler(
  key: "page" | "pageSize",
  controlled: boolean,
  handled: boolean,
): void {
  if (!dev() || !controlled || handled) return
  const handler = key === "page" ? "onPageChange" : "onPageSizeChange"
  warn(
    `${key} is controlled without ${handler}: the value only changes when you pass a new ${key}; use default${key === "page" ? "Page" : "PageSize"} to let the pagination own it`,
  )
}
