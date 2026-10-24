<script lang="ts">
import { tourIds } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { keepStyle } from "../keep-style"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { usePresence } from "../use-presence.svelte"
import { tourApi, tourHost } from "./context.svelte"
import type { TourPositionerProps } from "./types"

const { child, children, ...rest }: TourPositionerProps = $props()
const ctx = tourHost.get()
const base = $derived(tourApi(ctx))
const shown = $derived(base.state === "active")
// The target's direction: the portalled positioner carries it (inline sides, RTL).
let dir = $state<"ltr" | "rtl" | undefined>(undefined)
$effect(() => {
  if (!shown) return
  const anchor = base.step?.target?.() ?? document.getElementById(tourIds(ctx.tour.root).trigger)
  const found = anchor?.closest("[dir]")?.getAttribute("dir")
  dir = found === "rtl" ? "rtl" : "ltr"
})
const el = elementRef("div")
// It holds the content: it stays while the content's exit animations run.
const presence = usePresence(
  () => shown,
  () => el.current,
  { subtree: () => true },
)
// Positioning writes to this element's style too.
const kept = keepStyle()
const merged = $derived(
  kept(
    stripMarker(
      mergeProps(
        { ...normalizeProps(tourApi(ctx, dir ? { dir } : {}).api.positioner()), ...el.props },
        rest,
      ),
    ),
  ),
)
</script>

{#if presence.mounted}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{@render children?.()}</div>
  {/if}
{/if}
