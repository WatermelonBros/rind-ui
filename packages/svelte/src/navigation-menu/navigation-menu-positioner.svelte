<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { keepStyle } from "../keep-style"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { usePresence } from "../use-presence.svelte"
import { navItem, navLevel } from "./context.svelte"
import type { NavigationMenuPositionerProps } from "./types"

// Places the Viewport next to the open trigger; inside an Item (no Viewport), places that
// item's Content next to its own trigger.
const {
  anchor = "trigger",
  positioning,
  child,
  children,
  ...rest
}: NavigationMenuPositionerProps = $props()
const ctx = navLevel.get()
const inItem = navItem.maybe()
// An item of this level (a Sub's Positioner sits in its parent's item, not its own).
const item = untrack(() => (inItem?.root === ctx.root() ? inItem.key : undefined))
const el = elementRef("div")
const open = $derived(item === undefined ? ctx.value() !== null : ctx.value() === item)
const presence = usePresence(
  () => open,
  () => el.current,
  { subtree: () => true },
)
const exiting = $derived(!open && presence.state === "exiting")
$effect(() => {
  void JSON.stringify(positioning ?? null)
  const p = { anchor, positioning, perItem: item !== undefined }
  return untrack(() => ctx.registerPositioner(item ?? "", p))
})
// Positioning writes to this element's style too.
const kept = keepStyle()
const merged = $derived(
  kept(
    stripMarker(
      mergeProps(
        {
          ...normalizeProps(ctx.api().positioner(item)),
          hidden: !open && !exiting ? true : undefined,
          ...el.props,
        },
        rest,
      ),
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
