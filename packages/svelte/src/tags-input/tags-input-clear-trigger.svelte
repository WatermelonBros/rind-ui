<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { tagsInputHost } from "./context"
import type { TagsInputClearTriggerProps } from "./types"

const { child, children, ...rest }: TagsInputClearTriggerProps = $props()
const host = tagsInputHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().clearTrigger()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...attrs(merged)}>{@render children?.()}</button>
{/if}
