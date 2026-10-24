<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { usePresence } from "../use-presence.svelte"
import { tourApi, tourHost } from "./context.svelte"
import type { TourBackdropProps } from "./types"

const { child, children, ...rest }: TourBackdropProps = $props()
const ctx = tourHost.get()
// Mounted after hydration only: a `defaultOpen` tour renders nothing on the server.
let hydrated = $state(false)
$effect(() => {
  hydrated = true
})
const el = elementRef("div")
const api = $derived(tourApi(ctx).api)
// The tour's whole run: the same node between steps (no flash).
const presence = usePresence(
  () => api.open,
  () => el.current,
)
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(api.backdrop()), ...el.props }, rest)),
)
</script>

{#if presence.mounted && hydrated}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{@render children?.()}</div>
  {/if}
{/if}
