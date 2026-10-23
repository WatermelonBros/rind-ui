<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { compositeHost } from "../composite-host.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { type ToolbarHost, useToolbar } from "./host.svelte"
import type { ToolbarGroupProps } from "./types"

const { disabled = false, child, children, ...rest }: ToolbarGroupProps = $props()
const host = useToolbar("Group")
const groupDisabled = $derived(host.disabled || disabled)
// The same host, disabled for the controls inside (hosted composites included).
const inner: ToolbarHost = Object.create(host, {
  disabled: { get: () => groupDisabled, enumerable: true },
})
compositeHost.set(inner)
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(host.api.group(groupDisabled)), rest)),
)
const current = $derived({ disabled: groupDisabled })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
