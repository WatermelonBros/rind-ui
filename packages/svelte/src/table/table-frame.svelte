<script lang="ts">
import {
  type ChangeDetails,
  type TableFrameEvent,
  tableFrameConnect,
  tableFrameIds,
  tableFrameMachine,
  tableMessages,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { frameHost } from "./context.svelte"
import type { TableFrameProps } from "./types"

let {
  expanded = $bindable(),
  defaultExpanded,
  onExpandedChange,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: TableFrameProps = $props()
const uid = $props.id()
const instance = $derived(id ?? uid)
const messages = useMessages("table", tableMessages, () => ownMessages)
const env = useEnvironment()
const machine = useMachine(
  tableFrameMachine,
  () => ({
    root: instance,
    expanded,
    defaultExpanded,
    onExpandedChange: (next: boolean, details: ChangeDetails<TableFrameEvent>) => {
      let cancelled = false
      onExpandedChange?.(next, {
        ...details,
        cancel: () => {
          cancelled = true
          details.cancel()
        },
      })
      if (!cancelled && expanded !== undefined) expanded = next
    },
  }),
  env,
)
const shared = $state({
  caption: undefined as string | undefined,
  title: undefined as string | undefined,
})
const isExpanded = $derived(machine.view.values.expanded)
const api = $derived(
  tableFrameConnect({
    instance,
    expanded: isExpanded,
    messages: messages(),
    captionId: shared.caption ?? shared.title,
    ids: tableFrameIds(instance),
  }),
)
frameHost.set({
  instance: () => instance,
  api: () => api,
  send: machine.send,
  expanded: () => isExpanded,
  shared,
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(api.frame()), rest)))
const current = $derived({ expanded: isExpanded })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
