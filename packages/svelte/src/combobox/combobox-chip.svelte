<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { comboboxChip, comboboxHost } from "./context"
import type { ComboboxChipProps } from "./types"

const { child, children, ...rest }: ComboboxChipProps = $props()
const host = comboboxHost.get()
const key = comboboxChip.maybe()
if (key === undefined) throw new Error("Combobox.Chip must be inside Combobox.Chips")
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().chip(key)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
