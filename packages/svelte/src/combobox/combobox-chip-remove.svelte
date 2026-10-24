<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { comboboxChip, comboboxHost } from "./context"
import type { ComboboxChipRemoveProps } from "./types"

const { child, children, ...rest }: ComboboxChipRemoveProps = $props()
const host = comboboxHost.get()
const key = comboboxChip.maybe()
if (key === undefined) throw new Error("Combobox.ChipRemove must be inside Combobox.Chips")
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().chipRemove(key)), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...attrs(merged)}
    >{#if children}{@render children()}{:else}<span aria-hidden="true">×</span>{/if}</button
  >
{/if}
