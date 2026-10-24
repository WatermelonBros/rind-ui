<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useIcon } from "../provider"
import { frameHost, useFocus } from "./context.svelte"
import type { TableExpandTriggerProps } from "./types"

const { expanded, collapsed, child, children, ...rest }: TableExpandTriggerProps = $props()
const f = frameHost.get()
const focus = useFocus()
const icons = { in: useIcon("arrows-in"), out: useIcon("arrows-out") }
const isExpanded = $derived(f.expanded())
const own = $derived(isExpanded ? (expanded ?? children) : (collapsed ?? children))
const Icon = $derived(isExpanded ? icons.in() : icons.out())
const current = $derived({ expanded: isExpanded })
const merged = $derived(
  stripMarker(
    mergeProps(
      joinHandlers(
        normalizeProps(
          f.api().expandTrigger({
            named: children !== undefined,
            focused: focus.focused,
            modality: focus.modality,
          }),
        ),
        focus.handlers,
        { onclick: () => f.send({ type: "TOGGLE" }) },
      ),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{#if own}{@render own(current)}{:else if Icon}<Icon />{/if}</button>
{/if}
