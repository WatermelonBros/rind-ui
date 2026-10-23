<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { accordionContext, accordionItem } from "./context"
import type { AccordionHeaderProps } from "./types"

const { child, children, ...rest }: AccordionHeaderProps = $props()
const root = accordionContext.get()
const state = accordionItem.get()
const level = $derived(root.level())
const el = elementRef(() => `h${level}`)
// APG: the button is the heading's only element (base-ui#3632).
$effect(() => {
  const node = el.current
  if (!DEV || !node) return
  const others = Array.from(node.children).filter((c) => c.getAttribute("data-part") !== "trigger")
  if (others.length > 0) {
    console.warn(
      `[rind-ui] accordion: the header of item "${state().item}" contains elements besides its trigger; the trigger must be the heading's only element`,
    )
  }
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(root.api().header(state(), level, el.tag)), ...el.props }, rest),
  ),
)
const current = $derived({ open: state().open, disabled: state().disabled })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the heading's attributes. -->
  <svelte:element this={`h${level}`} {...merged as HTMLAttributes<HTMLHeadingElement>}>{@render children?.(current)}</svelte:element>
{/if}
