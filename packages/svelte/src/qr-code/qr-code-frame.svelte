<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { SVGAttributes } from "svelte/elements"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useRenderedId } from "../use-ids.svelte"
import { qrCodeContext } from "./context"
import type { QrCodeFrameProps } from "./types"

/** The symbol: an `svg` with the quiet zone in its viewBox, named when there is a symbol. */
const { "aria-describedby": describedBy, child, children, ...rest }: QrCodeFrameProps = $props()
const ctx = qrCodeContext.get()
const valueTextId = useRenderedId(ctx.registry, "value-text")
const named = $derived(rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined)
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps(
        ctx.connect().frame({
          named,
          valueTextId: valueTextId.current,
          ...(describedBy === undefined || describedBy === null ? {} : { describedBy }),
        }),
      ),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <svg {...merged as SVGAttributes<SVGSVGElement>}>{@render children?.(ctx.state())}</svg>
{/if}
