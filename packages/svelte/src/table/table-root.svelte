<script lang="ts">
import {
  announcerCapability,
  type ChangeDetails,
  domTableMetrics,
  type PinnedColumns,
  quirkActive,
  type SortDescriptor,
  type TableEvent,
  type TableSortValue,
  tableConnect,
  tableMachine,
  tableMessages,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { frameHost, tableHost } from "./context.svelte"
import type { TableRenderState, TableRootProps } from "./types"

let {
  sort = $bindable(),
  defaultSort,
  onSortChange,
  allowUnsorted,
  stickyFirstColumn = false,
  pinnedColumns = $bindable(),
  defaultPinnedColumns,
  onPinnedColumnsChange,
  expandedRows = $bindable(),
  defaultExpandedRows,
  onExpandedRowsChange,
  multiple,
  rowCount,
  rowRange,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: TableRootProps = $props()

/** A change the consumer may cancel; written back only when bound. */
function proposer<V>(
  own: ((value: V, details: ChangeDetails<TableEvent>) => void) | undefined,
  write: (value: V) => void,
) {
  return (value: V, details: ChangeDetails<TableEvent>) => {
    let cancelled = false
    own?.(value, {
      ...details,
      cancel: () => {
        cancelled = true
        details.cancel()
      },
    })
    if (!cancelled) write(value)
  }
}

// Inside a Frame the Root shares its instance: every part of the table is one instance.
const frame = frameHost.maybe()
const uid = $props.id()
const instance = $derived(id ?? frame?.instance() ?? uid)
const env = useEnvironment(announcerCapability)
const messages = useMessages("table", tableMessages, () => ownMessages)
const locale = useLocale(() => ownLocale)
const registry = usePartRegistry<"caption">({ scope: "table", root: untrack(() => instance) })
const tableEnv = { ...env, tableMetrics: domTableMetrics(env) }
// One box per descriptor: the machine compares by content.
const box = (value: SortDescriptor | null): TableSortValue => ({ value })
const controlled = $derived(sort === undefined ? undefined : box(sort))
const initial = untrack(() => (defaultSort === undefined ? undefined : box(defaultSort)))
const machine = useMachine(
  tableMachine,
  () => ({
    root: instance,
    messages: messages(),
    lang: locale.current.locale,
    sort: controlled,
    defaultSort: initial,
    onSortChange: proposer<TableSortValue>(
      onSortChange ? (s, d) => onSortChange(s.value, d) : undefined,
      (s) => {
        if (sort !== undefined) sort = s.value
      },
    ),
    allowUnsorted,
    pinnedColumns,
    defaultPinnedColumns,
    onPinnedColumnsChange: proposer<PinnedColumns>(onPinnedColumnsChange, (p) => {
      if (pinnedColumns !== undefined) pinnedColumns = p
    }),
    rowCount,
    rowRange,
    expandedRows,
    defaultExpandedRows,
    onExpandedRowsChange: proposer<readonly string[]>(onExpandedRowsChange, (r) => {
      if (expandedRows !== undefined) expandedRows = r
    }),
    multiple,
  }),
  tableEnv,
)
let mounted = $state(false)
$effect(() => {
  mounted = true
})
let emptyCount = $state(0)
const columns = new Set<string>()
const tableLabel = { current: undefined as string | undefined }
const captionId = useRenderedId(registry, "caption")
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
$effect(() => env.modality.subscribe(() => {}))
const view = $derived(machine.view)
const current = $derived<TableRenderState>({
  sort: view.values.sort.value,
  scrollStop: view.context.tabStop,
})
const api = $derived.by(() => {
  const c = view.context
  return tableConnect({
    instance,
    sort: view.values.sort.value,
    messages: messages(),
    tabStop: c.tabStop,
    holdsControls: c.measured && (c.overflow.x || c.overflow.y) && c.tabbableContent,
    overflow: c.overflow,
    edges: c.edges,
    focused,
    modality: modality.current,
    stickyFirstColumn,
    empty: emptyCount > 0,
    captionId: captionId.current ?? frame?.shared.title,
    tableLabel: tableLabel.current,
    describeSort: mounted && quirkActive("talkback-aria-sort", env),
    pinned: view.values.pinnedColumns,
    expandedRows: view.values.expandedRows,
  })
})
tableHost.set({
  api: () => api,
  send: machine.send,
  state: () => current,
  instance: () => instance,
  registry,
  captioned: () => captionId.current !== undefined,
  frame,
  columns,
  setEmpty: (d) => (emptyCount += d),
  tableLabel,
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(normalizeProps(api.root()), {
          onfocus: (e: FocusEvent) => {
            if (e.target !== e.currentTarget) return
            focused = true
            machine.send({ type: "ROOT.FOCUS" })
          },
          onblur: (e: FocusEvent) => {
            if (e.target !== e.currentTarget) return
            focused = false
            machine.send({ type: "ROOT.BLUR" })
          },
        }),
        ...(id === undefined ? {} : { id }),
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
