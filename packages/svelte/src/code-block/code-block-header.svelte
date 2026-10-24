<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { codeBlockContext } from "./context"
import type { CodeBlockPartProps } from "./types"

const { child, children, ...rest }: CodeBlockPartProps = $props()
const ctx = codeBlockContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().header()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
