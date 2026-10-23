<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { progressContext } from "./context"
import type { ProgressPartProps } from "./types"

// The fill, sized by `--rind-progress-percent`.
const { child, children, ...rest }: ProgressPartProps = $props()
const ctx = progressContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().indicator()), rest)))
const current = $derived(ctx.state())
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...merged as HTMLAttributes<HTMLDivElement>}>{@render children?.(current)}</div>
{/if}
