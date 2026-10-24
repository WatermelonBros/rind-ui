import type {
  SortDirection,
  TableEvent,
  TableFrameEvent,
  tableConnect,
  tableFrameConnect,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import { createContext } from "../context"
import { DEV } from "../dev"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import type { TableRenderState } from "./types"

type Api = ReturnType<typeof tableConnect>
type FrameApi = ReturnType<typeof tableFrameConnect>

export interface FrameHost {
  readonly instance: () => string
  readonly api: () => FrameApi
  readonly send: (event: TableFrameEvent) => void
  readonly expanded: () => boolean
  /** Mutable shared state (a `$state` object owned by the Frame). */
  readonly shared: {
    caption: string | undefined
    /** The Title's id: names the table and the full-page view when there is no Caption. */
    title: string | undefined
  }
}
export const frameHost = createContext<FrameHost>("table-frame")

export interface TableHost {
  readonly api: () => Api
  readonly send: (event: TableEvent) => void
  readonly state: () => TableRenderState
  readonly instance: () => string
  readonly registry: PartRegistry<"caption">
  readonly captioned: () => boolean
  /** The Frame around the Root, when there is one (the Caption names it while expanded). */
  readonly frame: FrameHost | undefined
  /** Column ids, for the duplicate check. */
  readonly columns: Set<string>
  readonly setEmpty: (delta: 1 | -1) => void
  readonly tableLabel: { current: string | undefined }
}
export const tableHost = createContext<TableHost>("table")

export interface RowHost {
  readonly id: () => string | undefined
  /** The RowHeader's text (measured after mount; the id until then). */
  readonly text: () => string | undefined
}
export const rowHost = createContext<RowHost>("table-row")

export interface ColumnHost {
  readonly id: () => string | undefined
  readonly firstDirection: () => SortDirection
  readonly sortable: () => boolean
  /** The column's text (measured after mount; the id until then). */
  readonly text: () => string
  /** A Filter registers while mounted. */
  readonly addFilter: () => () => void
}
export const columnHost = createContext<ColumnHost>("table-column")

/** The column a sort part sits in; throws outside a sortable ColumnHeader. */
export function useSortColumn(
  part: string,
): Omit<ColumnHost, "id"> & { readonly id: () => string } {
  const column = columnHost.maybe()
  if (!column?.sortable()) {
    throw new Error(`Table.${part} must be inside a sortable Table.ColumnHeader`)
  }
  // A sortable column has an id (the ColumnHeader throws otherwise).
  return { ...column, id: () => column.id() as string }
}

export interface FilterHost {
  readonly column: ColumnHost
  readonly active: () => boolean
}
export const filterHost = createContext<FilterHost>("table-filter")

/** Focus and modality of a button part. Call during initialisation. */
export function useFocus() {
  const env = useEnvironment()
  // The modality tracker needs a subscriber while the button is mounted.
  $effect(() => env.modality.subscribe(() => {}))
  let focused = $state(false)
  const modality = useModality(env.modality, () => focused)
  return {
    env,
    get focused() {
      return focused
    },
    get modality() {
      return modality.current
    },
    handlers: {
      onfocus: () => (focused = true),
      onblur: () => (focused = false),
    },
  }
}

/** The leaf columns' count, read from the head after mount (Empty, RowDetails). Read `.current`. */
export function useLeafColumns(row: () => Element | null, given: () => number | undefined) {
  let counted = $state<number | undefined>(undefined)
  $effect(() => {
    if (given() !== undefined) return
    const table = row()?.closest("table")
    const last = table?.tHead?.rows[(table.tHead?.rows.length ?? 1) - 1]
    if (!last) return
    let n = 0
    for (const cell of Array.from(last.cells)) n += cell.colSpan || 1
    counted = n
  })
  return {
    get current() {
      return given() ?? counted
    },
  }
}

const warned = new Set<string>()
export function warnOnce(instance: string, message: string) {
  if (!DEV) return
  const key = `${instance}:${message}`
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`[rind-ui] table: ${message}`)
}
