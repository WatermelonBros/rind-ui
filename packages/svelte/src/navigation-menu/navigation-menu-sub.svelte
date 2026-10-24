<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { navLevel, useLevelState } from "./context.svelte"
import type { NavigationMenuSubProps } from "./types"

// A nested level inside a Content: its own List, items and value; not a landmark.
let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  orientation,
  id,
  child,
  children,
  ...rest
}: NavigationMenuSubProps = $props()
const parent = navLevel.get()
const uid = $props.id()
const ctx = useLevelState(
  () => ({
    value,
    defaultValue,
    onValueChange: (v, d) => {
      onValueChange?.(v, d)
      if (value !== undefined) value = v as string | null
    },
    orientation,
    id: id ?? undefined,
    uid,
    disabled: parent.disabled(),
    ...parent.delays(),
    closedContent: parent.closedContent(),
    defaultOrientation: "vertical",
  }),
  parent,
)
navLevel.set(ctx)
const merged = $derived(stripMarker(mergeProps(normalizeProps(ctx.api().sub()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
