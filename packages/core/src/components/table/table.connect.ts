// Table parts (design §3): a native table with no role added to any table element and no
// handler on rows or cells. The Root is the scroll container: a named `group` and tab stop
// only while it overflows with nothing focusable inside (measured on the client, never in the
// server HTML). `aria-sort` goes on the sorted column's header only (APG); the sort trigger is
// a real button named by the column's text.

import { focusAttrs } from "../../a11y/focus"
import { CRITICAL, dataFlag, type PartProps, scopeAttrs } from "../../connect/props"
import type { Modality } from "../../contract/env"
import { itemId } from "../../ids"
import type { AxisFlags, EdgeFlags } from "../scroll-area/scroll-area.machine"
import type { TableMessages } from "./table.messages"
import type { SortDescriptor } from "./table.sort"

export type TablePart =
  | "root"
  | "table"
  | "caption"
  | "head"
  | "body"
  | "foot"
  | "row"
  | "column-header"
  | "row-header"
  | "cell"
  | "sort-trigger"
  | "sort-indicator"
  | "empty"

export interface TableConnectInput {
  readonly instance: string
  readonly sort: SortDescriptor | null
  readonly messages: TableMessages
  /** Measured on the client (false on the server and before the first measurement). */
  readonly tabStop: boolean
  /** Measured: it overflows and holds controls (Firefox would still make it a tab stop). */
  readonly holdsControls: boolean
  readonly overflow: AxisFlags
  /** Logical edges: `xStart` is content hidden before the visible part in reading order. */
  readonly edges: EdgeFlags
  readonly focused: boolean
  readonly modality: Modality
  readonly stickyFirstColumn: boolean
  /** An Empty row is mounted. */
  readonly empty: boolean
  /** The rendered Caption's id, when there is one. */
  readonly captionId: string | undefined
  /** The Table's own `aria-label` (the Root's name while it is a stop, with no Caption). */
  readonly tableLabel: string | undefined
  /** The `talkback-aria-sort` quirk is active: the sorted trigger carries its state. */
  readonly describeSort: boolean
}

export type SortTriggerDirection = "ascending" | "descending" | "none"

export function tableConnect(input: TableConnectInput) {
  const base = (part: TablePart) => scopeAttrs("table", part, input.instance)
  const direction = (column: string): SortTriggerDirection =>
    input.sort?.column === column ? input.sort.direction : "none"
  const sortStateId = (column: string) => itemId("table", input.instance, "sort-state", column)
  return {
    root: (): PartProps => ({
      ...base("root"),
      // Quirk firefox-scroller-tab-stop: Firefox puts a scroll container in the tab order even
      // when it holds controls; the controls are the way in, so it is taken out (-1).
      tabindex: input.tabStop ? 0 : input.holdsControls ? -1 : undefined,
      role: input.tabStop ? "group" : undefined,
      "aria-labelledby": input.tabStop ? input.captionId : undefined,
      "aria-label": input.tabStop && input.captionId === undefined ? input.tableLabel : undefined,
      "data-overflow-x": dataFlag(input.overflow.x),
      "data-overflow-y": dataFlag(input.overflow.y),
      "data-overflow-x-start": dataFlag(input.edges.xStart),
      "data-overflow-x-end": dataFlag(input.edges.xEnd),
      "data-sticky-first-column": dataFlag(input.stickyFirstColumn),
      "data-focus-visible": focusAttrs(input.focused, input.modality)["data-focus-visible"],
    }),
    /** `loading`: the Table part's own prop. */
    table: (t: { readonly loading: boolean }): PartProps => ({
      ...base("table"),
      "aria-busy": t.loading ? "true" : undefined,
      "data-loading": dataFlag(t.loading),
      "data-sorted": dataFlag(input.sort !== null),
      "data-empty": dataFlag(input.empty),
    }),
    caption: (id: string): PartProps => ({ ...base("caption"), id }),
    head: (): PartProps => base("head"),
    body: (): PartProps => base("body"),
    foot: (): PartProps => base("foot"),
    row: (): PartProps => base("row"),
    columnHeader: (h: {
      readonly colSpan?: number | undefined
      /** The column id when sortable. */
      readonly sortable?: string | undefined
    }): PartProps => {
      const sorted = h.sortable !== undefined && input.sort?.column === h.sortable
      return {
        ...base("column-header"),
        scope: (h.colSpan ?? 1) > 1 ? "colgroup" : "col",
        "data-sortable": dataFlag(h.sortable !== undefined),
        "aria-sort": sorted ? input.sort?.direction : undefined,
        "data-sort": sorted ? input.sort?.direction : undefined,
        [CRITICAL]: ["scope", "aria-sort"],
      }
    },
    rowHeader: (h: { readonly rowSpan?: number | undefined }): PartProps => ({
      ...base("row-header"),
      scope: (h.rowSpan ?? 1) > 1 ? "rowgroup" : "row",
      [CRITICAL]: ["scope"],
    }),
    cell: (): PartProps => base("cell"),
    sortTrigger: (
      column: string,
      f: { readonly focused: boolean; readonly modality: Modality } = {
        focused: false,
        modality: "pointer",
      },
    ): PartProps => {
      const d = direction(column)
      return {
        ...base("sort-trigger"),
        ...focusAttrs(f.focused, f.modality),
        type: "button",
        "data-direction": d,
        "aria-describedby": input.describeSort && d !== "none" ? sortStateId(column) : undefined,
      }
    },
    /** The visually hidden sort state a TalkBack trigger is described by; null when none. */
    sortState: (column: string): { readonly id: string; readonly text: string } | null => {
      const d = direction(column)
      if (!input.describeSort || d === "none") return null
      return { id: sortStateId(column), text: input.messages.sortState(d) }
    },
    sortIndicator: (column: string): PartProps => ({
      ...base("sort-indicator"),
      "aria-hidden": "true",
      "data-direction": direction(column),
    }),
    empty: (): PartProps => base("empty"),
  }
}
