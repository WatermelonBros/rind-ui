<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { clipboardContext } from "./context.svelte"
import type { ClipboardValueTextProps } from "./types"

const { child, children, ...rest }: ClipboardValueTextProps = $props()
const ctx = clipboardContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().valueText()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{ctx.state().value}{/if}</span>
{/if}
