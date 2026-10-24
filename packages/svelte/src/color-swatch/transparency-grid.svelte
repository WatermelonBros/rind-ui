<script lang="ts">
import { stripMarker, transparencyGridProps } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import type { TransparencyGridProps } from "./types"

// A decorative checkerboard filling its parent, under a colour that has transparency.
const { scope = "color-swatch", child, children, ...rest }: TransparencyGridProps = $props()
const instance = $props.id()
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(transparencyGridProps(scope, instance)), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
