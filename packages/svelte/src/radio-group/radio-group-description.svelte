<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { radioGroupContext } from "./context"
import type { RadioGroupPartProps } from "./types"

const { child, children, ...rest }: RadioGroupPartProps<HTMLElement> = $props()
const ctx = radioGroupContext.get()
useRegisterPart(ctx.parts, "description", () => ctx.ids().description)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().description()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <p {...attrs(merged)}>{@render children?.(undefined)}</p>
{/if}
