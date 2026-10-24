<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { listboxHost } from "./context"
import type { ListboxPartProps } from "./types"

const { child, children, ...rest }: ListboxPartProps = $props()
const host = listboxHost.get()
const el = elementRef("div")
const shown = $derived(host.parts().isEmpty)
$effect(() => {
  if (!shown) return
  untrack(() => host.mount("empty", true))
  return () => untrack(() => host.mount("empty", false))
})
// Development: the empty part is a sibling of the list, never inside it.
$effect(() => {
  if (DEV && el.current?.closest('[role="listbox"]'))
    console.warn(`[rind-ui] ${host.name}: Empty is inside the list; render it after List.`)
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(host.parts().empty()), ...el.props }, rest)),
)
</script>

{#if shown}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{@render children?.()}</div>
  {/if}
{/if}
