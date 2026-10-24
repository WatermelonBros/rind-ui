<script lang="ts">
import { focusSafely, labelInteraction, partId, warnOwnLabelInField } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useRegisterPart } from "../use-ids.svelte"
import { ratingContext } from "./context"
import type { RatingLabelProps } from "./types"

/** The visible name; a press focuses the range input (Safari does not, from a label). */
const { child, children, ...rest }: RatingLabelProps = $props()
const ctx = ratingContext.get()
const env = useEnvironment()
useRegisterPart(ctx.registry, "label", () => partId("rating", ctx.instance(), "label"))
$effect(() => {
  if (ctx.inField) warnOwnLabelInField("rating")
})
const target = () => (ctx.input.current && !ctx.input.current.disabled ? ctx.input.current : null)
const interaction = normalizeProps(
  labelInteraction(env, {
    target,
    forwardsFocus: () => true,
    // A pointer press: no focus ring.
    focusTarget: () => {
      const el = target()
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
