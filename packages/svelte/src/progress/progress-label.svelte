<script lang="ts">
import { partId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { progressContext } from "./context"
import type { ProgressPartProps } from "./types"

// The name: Root is `aria-labelledby` it while it is rendered.
const { id, child, children, ...rest }: ProgressPartProps = $props()
const ctx = progressContext.get()
const labelId = $derived(id ?? partId("progress", ctx.instance(), "label"))
useRegisterPart(ctx.registry, "label", () => labelId)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().label(labelId)), rest)))
const current = $derived(ctx.state())
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <span {...attrs(merged)}>{@render children?.(current)}</span>
{/if}
