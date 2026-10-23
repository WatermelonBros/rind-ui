<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { formToggleContext, useApi } from "./context.svelte"
import type { FormToggleIndicatorProps } from "./types"

const { child, children, ...rest }: FormToggleIndicatorProps = $props()
const ctx = formToggleContext.get()
const apiFor = useApi(ctx)
const merged = $derived(stripMarker(mergeProps(normalizeProps(apiFor().indicator()), rest)))
const marks = $derived({
  checked: ctx.service.checked() === true,
  indeterminate: ctx.service.checked() === "indeterminate",
})
</script>

{#if child}
  {@render child({ props: merged, state: marks })}
{:else}
  <span {...attrs(merged)}>{@render children?.(marks)}</span>
{/if}
