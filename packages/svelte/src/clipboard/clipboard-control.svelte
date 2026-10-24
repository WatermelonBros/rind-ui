<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { clipboardContext } from "./context.svelte"
import type { ClipboardControlProps } from "./types"

const { child, children, ...rest }: ClipboardControlProps = $props()
const ctx = clipboardContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().control()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
