<script lang="ts">
import { selectionOf } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { api, selectHost } from "./context.svelte"
import type { SelectValueTextProps } from "./types"

const { child, children, ...rest }: SelectValueTextProps = $props()
const ctx = selectHost.get()
const env = useEnvironment()
const a = $derived(api(ctx, env))
const selected = $derived.by(() => {
  const keys = selectionOf(ctx.view().values.value)
  return keys === "all" ? [] : [...keys]
})
const text = $derived(a.valueTextContent())
const merged = $derived(stripMarker(mergeProps(normalizeProps(a.valueText()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <!-- A new node per value: WebKit re-reads a replaced node, not an updated one (zag#3099). -->
  <span {...attrs(merged)}
    >{#if children}{@render children(selected)}{:else}{#key text}<span>{text}</span>{/key}{/if}</span
  >
{/if}
