<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { frameHost } from "./context.svelte"
import type { TableFramePartProps } from "./types"

const { id, child, children, ...rest }: TableFramePartProps = $props()
const f = frameHost.get()
const own = $derived(id ?? `table-${f.instance()}-title`)
$effect.pre(() => {
  f.shared.title = own
  return () => (f.shared.title = undefined)
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(f.api().title(own)), rest)))
const current = $derived({ expanded: f.expanded() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
