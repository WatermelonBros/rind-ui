<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { keepStyle } from "../keep-style"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { api, isOpen, tooltipHost, usePart } from "./context.svelte"
import type { TooltipPositionerProps } from "./types"

const { child, children, ...rest }: TooltipPositionerProps = $props()
const ctx = tooltipHost.get()
const el = elementRef("div")
const part = usePart(ctx, () => el.current)
// The anchor's direction: the portalled positioner carries it (inline sides, RTL).
let dir = $state<"ltr" | "rtl" | undefined>(undefined)
$effect(() => {
  if (!isOpen(ctx)) return
  const found = ctx.shared.trigger?.closest("[dir]")?.getAttribute("dir")
  dir = found === "rtl" ? "rtl" : "ltr"
})
// Positioning writes to this element's style too.
const kept = keepStyle()
const merged = $derived(
  kept(
    stripMarker(
      mergeProps(
        { ...normalizeProps(api(ctx, dir).positioner()), hidden: part.hidden, ...el.props },
        rest,
      ),
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
