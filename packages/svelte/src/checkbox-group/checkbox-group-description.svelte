<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { checkboxGroupContext } from "./context"
import type { CheckboxGroupPartProps } from "./types"

const { child, children, ...rest }: CheckboxGroupPartProps<HTMLParagraphElement> = $props()
const ctx = checkboxGroupContext.get()
useRegisterPart(ctx.registry, "description", () => ctx.ids().description)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().description()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <p {...attrs(merged)}>{@render children?.()}</p>
{/if}
