<script lang="ts">
import { visuallyHiddenStyle } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { Snippet } from "svelte"
import type { HTMLAttributes } from "svelte/elements"
import type { ChildArgs } from "./child"
import { mergeProps } from "./merge-props"
import { attrs, normalizeProps } from "./normalize-props"

// Read by assistive technology, not seen (never `display: none`).
const {
  focusable = false,
  child,
  children,
  ...rest
}: Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** Visible while it has focus (skip links). */
  readonly focusable?: boolean | undefined
  readonly child?: Snippet<[ChildArgs<{ focused: boolean }>]> | undefined
  readonly children?: Snippet<[{ focused: boolean }]> | undefined
} = $props()
let focused = $state(false)
const shown = $derived(focusable && focused)
const merged = $derived(
  stripMarker(
    mergeProps(
      normalizeProps({
        "data-visually-hidden": shown ? undefined : "",
        style: shown ? undefined : visuallyHiddenStyle,
      }),
      focusable ? { onfocusin: () => (focused = true), onfocusout: () => (focused = false) } : {},
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: { focused } })}
{:else}
  <span {...attrs(merged)}>{@render children?.({ focused })}</span>
{/if}
