<script lang="ts">
// Color Swatch parts: wiring only; connect decides role, name and the inline colour.
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { swatchNaming, useSwatchProps } from "./context"
import type { ColorSwatchProps } from "./types"

const {
  id,
  color: input,
  respectAlpha,
  colorName,
  locale,
  messages,
  "aria-label": ariaLabel,
  child,
  children,
  ...rest
}: ColorSwatchProps = $props()
const uid = $props.id()
const swatch = useSwatchProps({
  instance: () => id ?? uid,
  color: () => input,
  respectAlpha: () => respectAlpha,
  colorName: () => colorName,
  locale: () => locale,
  messages: () => messages,
  ariaLabel: () => ariaLabel ?? undefined,
})
const naming = swatchNaming.maybe() ?? null
const s = $derived(swatch())
const merged = $derived(
  stripMarker(
    mergeProps(normalizeProps(naming ? s.api.root(naming.scope, naming.part) : s.api.root()), rest),
  ),
)
const state = $derived({
  color: s.color,
  transparent: (respectAlpha === false ? 1 : s.color.alpha) < 1,
})
</script>

{#if child}
  {@render child({ props: merged, state })}
{:else}
  <div {...attrs(merged)}>{@render children?.(state)}</div>
{/if}
