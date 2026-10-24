<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { sliderContext } from "./context"
import type { SliderPartProps } from "./types"

/** The formatted value (a range for two thumbs). Not a live region. */
const { child, children, ...rest }: SliderPartProps = $props()
const ctx = sliderContext.get()
const own = $derived(ctx.api().valueText())
const merged = $derived.by(() => {
  const { text: _text, ...props } = own
  return stripMarker(mergeProps(normalizeProps(props), rest))
})
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{own.text}{/if}</div>
{/if}
