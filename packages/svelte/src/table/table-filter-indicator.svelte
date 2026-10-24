<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useIcon } from "../provider"
import { filterHost, tableHost } from "./context.svelte"
import type { TableFilterIndicatorProps } from "./types"

const { active, child, children, ...rest }: TableFilterIndicatorProps = $props()
const ctx = tableHost.get()
const f = filterHost.get()
const icons = { funnel: useIcon("funnel"), simple: useIcon("funnel-simple") }
const isActive = $derived(f.active())
const own = $derived(isActive ? (active ?? children) : children)
const Icon = $derived(isActive ? icons.funnel() : icons.simple())
const merged = $derived(
  stripMarker(mergeProps(normalizeProps(ctx.api().filterIndicator(isActive)), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{#if own}{@render own(ctx.state())}{:else if Icon}<Icon />{/if}</span>
{/if}
