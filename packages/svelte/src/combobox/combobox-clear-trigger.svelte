<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { comboboxHost } from "./context"
import type { ComboboxClearTriggerProps } from "./types"

const { child, children, ...rest }: ComboboxClearTriggerProps = $props()
const host = comboboxHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().clearTrigger()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...attrs(merged)}>{@render children?.()}</button>
{/if}
