<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { listboxHost } from "./context"
import type { ListboxPartProps } from "./types"

const { child, children, ...rest }: ListboxPartProps = $props()
const host = listboxHost.get()
$effect(() => {
  untrack(() => host.mount("label", true))
  return () => untrack(() => host.mount("label", false))
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.parts().label()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
