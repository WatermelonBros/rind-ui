<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterPart } from "../use-ids.svelte"
import { checkboxGroupContext } from "./context"
import type { CheckboxGroupPartProps } from "./types"

const { child, children, ...rest }: CheckboxGroupPartProps<HTMLSpanElement> = $props()
const ctx = checkboxGroupContext.get()
useRegisterPart(ctx.registry, "label", () => ctx.ids().label)
const el = elementRef("span")
$effect(() => ctx.setLabelTag(el.tag))
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().label()), ...el.props }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <span {...attrs(merged)}>{@render children?.()}</span>
{/if}
