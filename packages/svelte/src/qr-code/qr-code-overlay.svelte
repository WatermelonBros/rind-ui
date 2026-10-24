<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { qrCodeContext } from "./context"
import type { QrCodeOverlayProps } from "./types"

/** Centred content over the symbol (a logo); the modules under it stay in the matrix. */
const { child, children, ...rest }: QrCodeOverlayProps = $props()
const ctx = qrCodeContext.get()
$effect(() => {
  untrack(() => ctx.report("overlay", true))
  return () => untrack(() => ctx.report("overlay", false))
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.connect().overlay()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ctx.state())}</div>
{/if}
