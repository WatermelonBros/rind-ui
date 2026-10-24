<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { DEV } from "../dev"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { usePress } from "../use-press.svelte"
import { comboboxHost } from "./context"
import type { ComboboxTriggerProps } from "./types"

const { child, children, ...rest }: ComboboxTriggerProps = $props()
const host = comboboxHost.get()
const env = useEnvironment()
// Inline: popup parts render nothing (combobox "Anatomy").
$effect(() => {
  if (host.inline && DEV) console.warn("[rind-ui] Combobox: an inline combobox renders no Trigger.")
})
// A forwarded label click only focuses it.
const press = usePress({
  env,
  send: (e) => {
    if (e.type === "PRESS") host.api().pressTrigger(e.modality)
  },
  disabled: host.disabled,
  labelActivation: "focus",
})
const merged = $derived(
  stripMarker(mergeProps(joinHandlers(normalizeProps(host.api().trigger()), press.props), rest)),
)
</script>

{#if !host.inline}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <button {...merged as HTMLButtonAttributes}>{@render children?.()}</button>
  {/if}
{/if}
