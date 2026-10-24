<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tagsInputHost } from "./context"
import type { TagsInputLabelProps } from "./types"

const { child, children, ...rest }: TagsInputLabelProps = $props()
const host = tagsInputHost.get()
$effect(() => {
  host.mountLabel(true)
  return () => host.mountLabel(false)
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().label()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <label {...attrs(merged)}>{@render children?.()}</label>
{/if}
