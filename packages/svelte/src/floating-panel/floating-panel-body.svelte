<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { floatingPanelContext } from "./context"
import type { FloatingPanelPartProps } from "./types"

/** The content; inert while minimised. */
const { child, children, ...rest }: FloatingPanelPartProps = $props()
const ctx = floatingPanelContext.get()
const el = elementRef("div")
$effect(() => {
  const node = el.current
  ctx.body.current = node instanceof HTMLElement ? node : null
})
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.api().body()), { ...el.props, ...rest })),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
