<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { clipboardContext } from "./context.svelte"
import type { ClipboardLabelProps } from "./types"

const { id, child, children, ...rest }: ClipboardLabelProps = $props()
const ctx = clipboardContext.get()
const own = $derived(id ?? ctx.ids().label)
useRegisterPart(ctx.registry, "label", () => own)
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().label()), id: own }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <label {...attrs(merged)}>{@render children?.(ctx.state())}</label>
{/if}
