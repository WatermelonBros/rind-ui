<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { usePresence } from "../use-presence.svelte"
import { popupHost } from "./context"
import type { ComboboxPopupProps } from "./types"

const { child, children, ...rest }: ComboboxPopupProps = $props()
const host = popupHost.get()
// Inline: popup parts render nothing (combobox "Anatomy").
$effect(() => {
  if (host.inline && DEV)
    console.warn(`[rind-ui] ${host.name}: an inline combobox renders no Popup.`)
})
const el = elementRef("div")
const presence = usePresence(
  () => host.open(),
  () => el.current,
  { keepMounted: host.keepMounted },
)
const exiting = $derived(!host.open() && presence.state === "exiting")
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(host.api().popup()),
        ...(exiting ? { inert: true } : {}),
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#if presence.mounted && !host.inline}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <div {...attrs(merged)}>{@render children?.()}</div>
  {/if}
{/if}
