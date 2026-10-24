<script lang="ts">
import { partId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { sliderContext } from "./context"
import type { SliderPartProps } from "./types"

const { child, children, ...rest }: SliderPartProps = $props()
const ctx = sliderContext.get()
// Help text, referenced by every thumb input's `aria-describedby`.
useRegisterPart(ctx.registry, "description", () => partId("slider", ctx.instance(), "description"))
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().description()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
