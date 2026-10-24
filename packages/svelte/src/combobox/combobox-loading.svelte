<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { comboboxHost } from "./context"
import type { ComboboxLoadingProps } from "./types"

const { child, children, ...rest }: ComboboxLoadingProps = $props()
const host = comboboxHost.get()
const merged = $derived(stripMarker(mergeProps(normalizeProps(host.api().loading()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
