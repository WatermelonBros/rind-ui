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
  | "frame"
  | "title"
  | "header"
  | "footer"
  | "expand-trigger"
  | "filter-trigger"
  | "filter-indicator"
  | "row-trigger"
  | "row-details"

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
  /** Column ids pinned at each edge. */
  readonly pinned?: { readonly start: readonly string[]; readonly end: readonly string[] }
  /** Row ids whose details are open. */
  readonly expandedRows?: readonly string[]
}

/** A header's column and what it holds (its name stays its text when it holds controls). */
export interface ColumnHeaderInput {
  readonly colSpan?: number | undefined
  /** The column id (any column; required for sorting and pinning). */
  readonly column?: string | undefined
  readonly sortable?: boolean | undefined
  /** It holds a control besides one SortTrigger (a filter): named by `text`. */
  readonly controls?: boolean | undefined
  /** The column's text (the SortTrigger's visible text, else the header's own). */
  readonly text?: string | undefined
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
    /** `id`: the row's id when it can expand. */
    row: (id?: string): PartProps => ({
      ...base("row"),
      "data-row": id,
      "data-expanded": dataFlag(id !== undefined && (input.expandedRows ?? []).includes(id)),
    }),
    rowTrigger: (
      row: string,
      t: {
        readonly text: string
        readonly named: boolean
        readonly focused: boolean
        readonly modality: Modality
      },
    ): PartProps => {
      const open = (input.expandedRows ?? []).includes(row)
      return {
        ...base("row-trigger"),
        ...focusAttrs(t.focused, t.modality),
        type: "button",
        "aria-expanded": String(open),
        "aria-controls": itemId("table", input.instance, "row-details", row),
        "aria-label": t.named ? undefined : input.messages.rowDetails(t.text),
        "data-expanded": dataFlag(open),
        [CRITICAL]: ["aria-expanded", "aria-controls"],
      }
    },
    rowDetails: (row: string): PartProps => {
      const open = (input.expandedRows ?? []).includes(row)
      return {
        ...base("row-details"),
        id: itemId("table", input.instance, "row-details", row),
        "data-row": row,
        "data-expanded": dataFlag(open),
        hidden: open ? undefined : true,
      }
    },
    columnHeader: (h: ColumnHeaderInput): PartProps => {
      const sortable = h.sortable === true && h.column !== undefined
      const sorted = sortable && input.sort?.column === h.column
      const side =
        h.column === undefined
          ? undefined
          : input.pinned?.start.includes(h.column)
            ? "start"
            : input.pinned?.end.includes(h.column)
              ? "end"
              : undefined
      return {
        ...base("column-header"),
        scope: (h.colSpan ?? 1) > 1 ? "colgroup" : "col",
        "data-column": h.column,
        "data-pinned": side,
        "data-sortable": dataFlag(sortable),
        "aria-sort": sorted ? input.sort?.direction : undefined,
        "data-sort": sorted ? input.sort?.direction : undefined,
        // MUI-X#19239: with a filter button inside, the header's name is still its text.
        "aria-label": h.controls && h.text ? h.text : undefined,
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
    filterTrigger: (
      column: string,
      f: { readonly text: string; readonly active: boolean; readonly named: boolean },
    ): PartProps => ({
      "data-part": "filter-trigger",
      "data-column": column,
      "data-active": dataFlag(f.active),
      "aria-label": f.named ? undefined : input.messages.filter(f.text),
      "aria-describedby": f.active
        ? itemId("table", input.instance, "filtered", column)
        : undefined,
    }),
    /** The hidden "Filtered" an active FilterTrigger is described by; null when inactive. */
    filterState: (column: string, active: boolean) =>
      active
        ? { id: itemId("table", input.instance, "filtered", column), text: input.messages.filtered }
        : null,
    filterIndicator: (active: boolean): PartProps => ({
      ...base("filter-indicator"),
      "aria-hidden": "true",
      "data-active": dataFlag(active),
    }),
  }
}

export interface TableFrameConnectInput {
  readonly instance: string
  readonly expanded: boolean
  readonly messages: TableMessages
  /** What names the expanded Frame: the Caption, else the Title, when rendered. */
  readonly captionId: string | undefined
  readonly ids: { readonly frame: string; readonly expandTrigger: string }
}

/** The Frame around Header, Root and Footer: a modal dialog only while expanded (full page). */
export function tableFrameConnect(input: TableFrameConnectInput) {
  const base = (part: TablePart) => ({
    ...scopeAttrs("table", part, input.instance),
    "data-expanded": dataFlag(input.expanded),
  })
  return {
    frame: (): PartProps => ({
      ...base("frame"),
      id: input.ids.frame,
      role: input.expanded ? "dialog" : undefined,
      "aria-modal": input.expanded ? "true" : undefined,
      "aria-labelledby": input.expanded ? input.captionId : undefined,
    }),
    header: (): PartProps => base("header"),
    /** Names the table and the full-page view when there is no Caption. */
    title: (id: string): PartProps => ({ ...base("title"), id }),
    footer: (): PartProps => base("footer"),
    expandTrigger: (t: {
      readonly named: boolean
      readonly focused: boolean
      readonly modality: Modality
    }): PartProps => ({
      ...base("expand-trigger"),
      ...focusAttrs(t.focused, t.modality),
      id: input.ids.expandTrigger,
      type: "button",
      "aria-pressed": String(input.expanded),
      "aria-label": t.named ? undefined : input.messages.expand,
      [CRITICAL]: ["aria-pressed"],
    }),
  }
}
