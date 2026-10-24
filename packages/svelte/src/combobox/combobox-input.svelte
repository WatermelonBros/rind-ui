<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLInputAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { usePress } from "../use-press.svelte"
import { comboboxHost } from "./context"
import type { ComboboxInputProps } from "./types"

const { child, ...rest }: ComboboxInputProps = $props()
const host = comboboxHost.get()
const env = useEnvironment()
// A forwarded label click only focuses it.
const press = usePress({
  env,
  send: (e) => {
    if (e.type === "PRESS") host.api().pressInput(e.modality)
  },
  disabled: host.disabled,
  labelActivation: "focus",
})
const el = elementRef("input")
// The completed suffix is selected, so the next keystroke replaces it.
$effect(() => {
  const range = host.api().completionRange
  const input = el.current as HTMLInputElement | null
  if (range && input && input.ownerDocument.activeElement === input) {
    input.setSelectionRange(range[0], range[1], "forward")
  }
})
const merged = $derived(
  stripMarker(
    mergeProps(
      { ...joinHandlers(normalizeProps(host.api().input()), press.props), ...el.props },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <!-- The value attribute follows the text (as React's controlled input). -->
  <input {...merged as HTMLInputAttributes} defaultValue={merged["value"] as string} />
{/if}
