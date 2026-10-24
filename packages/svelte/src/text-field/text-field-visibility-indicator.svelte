<script lang="ts">
import { textFieldVisibilityConnect } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { useFieldBindingPeek } from "../field/context.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { connectInput, textFieldContext, visibilityOf } from "./context"
import type { TextFieldVisibilityIndicatorProps } from "./types"

const { child, children, ...rest }: TextFieldVisibilityIndicatorProps = $props()
const ctx = textFieldContext.get()
// Peek, never claim: the Input is the Field's one control.
const binding = useFieldBindingPeek()
const visible = $derived(visibilityOf(ctx).visible)
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps(
        textFieldVisibilityConnect({
          ...connectInput(ctx),
          fieldData: binding?.().data ?? {},
        }).indicator(),
      ),
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: { visible } })}
{:else}
  <span {...attrs(merged)}>{@render children?.({ visible })}</span>
{/if}
