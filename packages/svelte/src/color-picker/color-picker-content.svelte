<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { colorFlush } from "../color-field/context"
import FieldControlBoundary from "../field/field-control-boundary.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import PopoverContent from "../popover/popover-content.svelte"
import { colorPicker } from "./context"
import type { ColorPickerDivProps } from "./types"

// The content: the Popover's, or (inline) a `role="group"` in place. Children are embedded.
const {
  "aria-label": label,
  "aria-labelledby": labelledBy,
  child,
  children,
  ...rest
}: ColorPickerDivProps = $props()
const ctx = colorPicker.get()
colorFlush.set(ctx.registry)
const name = $derived(
  ctx.api().contentName({ label: label ?? undefined, labelledBy: labelledBy ?? undefined }),
)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(ctx.api().inlineContent()),
        "aria-label": name.label,
        "aria-labelledby": name.labelledBy,
      },
      rest,
    ),
  ),
)
</script>

{#snippet body()}<FieldControlBoundary>{@render children?.(ctx.state())}</FieldControlBoundary>{/snippet}

{#if ctx.inline}
  {#if child}
    {@render child({ props: { ...merged, children: body }, state: ctx.state() })}
  {:else}
    <div {...attrs(merged)}>{@render body()}</div>
  {/if}
{:else}
  <PopoverContent
    {...rest as Record<string, unknown>}
    {...name.label === undefined ? {} : { "aria-label": name.label }}
    {...name.labelledBy === undefined ? {} : { "aria-labelledby": name.labelledBy }}
    >{@render body()}</PopoverContent
  >
{/if}
