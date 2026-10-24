<script lang="ts">
import { focusSafely } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { useFieldBindingPeek } from "../field/context.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { single, useDateRange } from "./context"
import type { DateFieldClearTriggerProps } from "./types"

// Clears the value and every draft segment, then focuses the first segment.
const { child, children, ...rest }: DateFieldClearTriggerProps = $props()
const range = useDateRange()
const binding = useFieldBindingPeek()
const host = single.maybe() ?? null
const env = useEnvironment()
const clear = () => {
  if (range) range.send({ type: "CLEAR" })
  else host?.ctx.send({ type: "CLEAR" })
  const scope = range ? range.inputEl : host?.ctx.inputEl
  const first = scope?.current?.querySelector<HTMLElement>("input[data-editable]")
  if (first) void focusSafely(first, env, "programmatic", env.modality.modality())
}
const own = $derived(
  range ? range.api(binding?.() ?? null).clearTrigger() : (host?.api().clearTrigger() ?? {}),
)
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(own), onclick: clear }, rest as Record<string, unknown>),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <button {...attrs(merged)}>{@render children?.()}</button>
{/if}
