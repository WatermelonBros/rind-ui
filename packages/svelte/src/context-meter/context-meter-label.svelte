<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { contextMeterContext } from "./context"
import type { ContextMeterLabelProps } from "./types"

const { id, child, children, ...rest }: ContextMeterLabelProps = $props()
const ctx = contextMeterContext.get()
const own = $derived(id ?? ctx.labelId())
useRegisterPart(ctx.registry, "label", () => own)
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().label()), id: own }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <span {...attrs(merged)}>{@render children?.(ctx.state())}</span>
{/if}
