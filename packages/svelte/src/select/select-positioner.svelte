<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { keepStyle } from "../keep-style"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { usePresence } from "../use-presence.svelte"
import { api, selectHost } from "./context.svelte"
import type { SelectPositionerProps } from "./types"

const { child, children, ...rest }: SelectPositionerProps = $props()
const ctx = selectHost.get()
const env = useEnvironment()
const el = elementRef("div")
const open = $derived(ctx.view().matches("open"))
// The trigger's direction: the portalled positioner carries it (inline sides, RTL).
let dir = $state<"ltr" | "rtl" | undefined>(undefined)
$effect(() => {
  if (!open) return
  const found = ctx.shared.trigger?.closest("[dir]")?.getAttribute("dir")
  dir = found === "rtl" ? "rtl" : "ltr"
})
const presence = usePresence(
  () => open,
  () => el.current,
  { keepMounted: ctx.keepMounted, subtree: () => true },
)
// Positioning writes to this element's style too.
const kept = keepStyle()
const merged = $derived(
  kept(
    stripMarker(
      mergeProps(
        {
          ...normalizeProps(api(ctx, env, dir ? { dir } : {}).positioner()),
          hidden: !open && ctx.keepMounted(),
          ...el.props,
        },
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
