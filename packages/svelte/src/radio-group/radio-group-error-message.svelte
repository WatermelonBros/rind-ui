<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { radioGroupContext } from "./context"
import type { RadioGroupPartProps } from "./types"

const { child, children, ...rest }: RadioGroupPartProps<HTMLParagraphElement> = $props()
const ctx = radioGroupContext.get()
// Inside a Field the Field's ErrorMessage is the one; shown only while invalid.
const shown = $derived(!ctx.inField && ctx.invalid())
useRegisterPart(ctx.parts, "error-message", () => (shown ? ctx.ids().errorMessage : undefined))
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().errorMessage()), rest)))
</script>

{#if shown}
  {#if child}
    {@render child({ props: merged, state: undefined })}
  {:else}
    <p {...attrs(merged)}>{@render children?.(undefined)}</p>
  {/if}
{/if}
