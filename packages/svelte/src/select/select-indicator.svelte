<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { api, selectHost } from "./context.svelte"
import type { SelectIndicatorProps } from "./types"

const { child, children, ...rest }: SelectIndicatorProps = $props()
const ctx = selectHost.get()
const env = useEnvironment()
const merged = $derived(stripMarker(mergeProps(normalizeProps(api(ctx, env).indicator()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
