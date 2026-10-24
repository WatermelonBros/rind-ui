<script lang="ts">
import { labelInteraction, partId } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLLabelAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useRegisterPart } from "../use-ids.svelte"
import { fieldParts } from "./context.svelte"
import type { FieldLabelProps } from "./types"

const { id, child, children, ...rest }: FieldLabelProps = $props()
const ctx = fieldParts.get()
const env = useEnvironment()
const own = $derived(id ?? partId("field", ctx.instance(), "label"))
useRegisterPart(ctx.registry, "label", () => own)
const el = elementRef("label")
$effect(() => ctx.setLabel(el.current))
// A non-labelable control (a group) is named by aria-labelledby; a press focuses it.
const interaction = normalizeProps(
  labelInteraction(env, {
    target: () => null,
    forwardsFocus: () => ctx.control()?.labelable === false,
    focusTarget: () => ctx.control()?.focus("pointer"),
  }),
)
const merged = $derived.by(() => {
  const part = ctx.api().label(own)
  return stripMarker(
    mergeProps(
      {
        ...normalizeProps({
          ...part,
          // Before the control registers (server render) the Field's control id is assumed.
          for: ctx.control() ? part["for"] : partId("field", ctx.instance(), "control"),
        }),
        ...interaction,
        ...el.props,
      },
      rest,
    ),
  )
})
const current = $derived({
  valid: ctx.api().display === "valid",
  invalid: ctx.api().display === "invalid",
  validating: false,
})
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the label's attributes and handlers. -->
  <label {...merged as HTMLLabelAttributes}>{@render children?.(current)}</label>
{/if}
