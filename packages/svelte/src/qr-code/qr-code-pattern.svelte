<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { SVGAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { qrCodeContext } from "./context"
import type { QrCodePatternProps } from "./types"

/** The dark modules: one path of merged runs. */
const { child, ...rest }: QrCodePatternProps = $props()
const ctx = qrCodeContext.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.connect().pattern()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <path {...merged as SVGAttributes<SVGPathElement>} />
{/if}
