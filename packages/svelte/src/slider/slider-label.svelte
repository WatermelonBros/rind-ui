<script lang="ts">
import { focusSafely, labelInteraction, partId, warnOwnLabelInField } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useRegisterPart } from "../use-ids.svelte"
import { sliderContext } from "./context"
import type { SliderLabelProps } from "./types"

/** The visible name; a press focuses the first enabled thumb (Safari does not, from a label). */
const { child, children, ...rest }: SliderLabelProps = $props()
const ctx = sliderContext.get()
const env = useEnvironment()
useRegisterPart(ctx.registry, "label", () => partId("slider", ctx.instance(), "label"))
$effect(() => {
  if (ctx.inField) warnOwnLabelInField("slider")
})
const firstEnabled = () => ctx.inputs.find((el) => el && !el.disabled) ?? null
const interaction = normalizeProps(
  labelInteraction(env, {
    target: firstEnabled,
    forwardsFocus: () => true,
    // A pointer press: no focus ring.
    focusTarget: () => {
      const el = firstEnabled()
      if (el) void focusSafely(el, env, "programmatic", "pointer")
    },
  }),
)
const merged = $derived(
  stripMarker(mergeProps({ ...normalizeProps(ctx.api().label()), ...interaction }, rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state: ctx.state() })}
{:else}
  <label {...attrs(merged)}>{@render children?.(ctx.state())}</label>
{/if}
