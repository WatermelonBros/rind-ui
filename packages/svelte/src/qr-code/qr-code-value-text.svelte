<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { qrCodeContext } from "./context"
import type { QrCodeValueTextProps } from "./types"

/**
 * The value as visually hidden text: the frame's description. Nothing while there is no
 * symbol (empty or invalid): there is no image for it to describe.
 */
const { id, child, children, ...rest }: QrCodeValueTextProps = $props()
const ctx = qrCodeContext.get()
const shown = $derived(ctx.state().state === "ready")
const own = $derived(ctx.connect().valueText())
const partIdOf = $derived(id ?? (own["id"] as string)) // connect always sets the part's id
useRegisterPart(ctx.registry, "value-text", () => (shown ? partIdOf : undefined))
$effect(() => {
  untrack(() => ctx.report("valueText", true))
  return () => untrack(() => ctx.report("valueText", false))
})
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(own), ...(id === undefined ? {} : { id }) }, rest)),
)
</script>

{#if shown}
  {#if child}
    {@render child({ props: merged, state: ctx.state() })}
  {:else}
    <span {...attrs(merged)}>{#if children}{@render children(ctx.state())}{:else}{ctx.value()}{/if}</span>
  {/if}
{/if}
