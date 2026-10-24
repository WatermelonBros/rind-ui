<script lang="ts">
import { linkProps, toKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { treeViewHost, treeViewItem } from "./context"
import type { TreeViewItemProps } from "./types"

const {
  value,
  href,
  target,
  rel,
  current,
  routerOptions,
  child,
  children,
  ...rest
}: TreeViewItemProps = $props()
const host = treeViewHost.get()
const key = $derived(toKey(value))
treeViewItem.set(() => key)
const el = elementRef(untrack(() => (href === undefined ? "div" : "a")))
const item = $derived(host.parts().item(key))
// Virtualized: a row highlighted by a key press mounts after the scroll. Focus left on the
// tree, on the previous row, or dropped to the body when that row unmounted moves to it.
const highlighted = $derived(item["data-highlighted"] !== undefined)
$effect(() => {
  const node = el.current
  if (!(node instanceof HTMLElement) || !highlighted) return
  untrack(() => {
    if (!host.focused()) return
    const doc = node.ownerDocument
    const active = doc.activeElement
    if (active === node) return
    const treeEl = node.closest('[role="tree"]')
    const dropped = active === null || active === doc.body
    const inTree =
      active !== null &&
      treeEl !== null &&
      (active === treeEl ||
        (active.getAttribute("role") === "treeitem" && active.closest('[role="tree"]') === treeEl))
    if (dropped || inTree) node.focus({ preventScroll: true })
  })
})
const wiring = {
  onpointerenter: () => host.setHovered(key),
  onpointerleave: () => host.setHovered(null),
  onpointerdown: (e: PointerEvent) => {
    host.setPressed(key)
    if (host.canMove(key)) host.startDrag(key, e)
  },
  onpointerup: () => host.setPressed(null),
  onpointercancel: () => host.setPressed(null),
}
const merged = $derived.by(() => {
  const own = { ...normalizeProps(item), ...el.props }
  if (href === undefined) return stripMarker(mergeProps(own, wiring, rest))
  const link = normalizeProps(
    linkProps(
      {
        href,
        target,
        rel,
        current,
        routerOptions,
        tag: "a",
        origin: typeof location === "undefined" ? undefined : location.origin,
      },
      host.env,
    ),
  )
  // The tree's roving tabindex and role win over the link's.
  return stripMarker(mergeProps(link, own, wiring, rest))
})
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else if href !== undefined}
  <a {...attrs(merged)}>{@render children?.()}</a>
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
