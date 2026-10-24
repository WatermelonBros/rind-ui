<script lang="ts">
import { toKey, warnForeignFocusables } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterItem } from "../use-collection-items.svelte"
import { gridListHost, gridListItem } from "./context.svelte"
import type { GridListItemProps } from "./types"

const {
  value,
  textValue,
  disabled,
  href,
  current,
  onAction,
  child,
  children,
  ...rest
}: GridListItemProps = $props()
const host = gridListHost.get()
const key = $derived(toKey(value))
const el = elementRef("div")
// The row's text is its ItemText, not its controls' labels (typeahead, announcements).
let ownText = $state<string | undefined>(undefined)
$effect(() => {
  const node = el.current
  if (!node) return
  const read = () => {
    const text = node
      .querySelector('[data-scope="grid-list"][data-part="item-text"]')
      ?.textContent?.trim()
    if (text !== untrack(() => ownText)) ownText = text
  }
  read()
  // Development: a focusable the grid cannot reach (not an ItemControl) is named once mounted.
  if (node instanceof HTMLElement) untrack(() => warnForeignFocusables(node, "GridList"))
  const observer = typeof MutationObserver === "function" ? new MutationObserver(read) : null
  observer?.observe(node, { characterData: true, childList: true, subtree: true })
  return () => observer?.disconnect()
})
useRegisterItem(
  host.registry,
  () => ({ key: value, textValue: textValue ?? ownText, disabled }),
  () => el.current,
)
$effect(() => {
  const k = key
  if (onAction === undefined) return
  untrack(() => host.mountRowAction(k, (d) => onAction?.(d)))
  return () => untrack(() => host.mountRowAction(k, null))
})
$effect(() => {
  const k = key
  const h = href
  if (h === undefined) return
  untrack(() => host.mountLink(k, h))
  return () => untrack(() => host.mountLink(k, null))
})
gridListItem.set(() => key)
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        // Connect's own pointer-down (the press commit) runs with the pressed-state tracking.
        ...joinHandlers(
          normalizeProps(
            host.parts().item(key, {
              "aria-label": rest["aria-label"] ?? undefined,
              "aria-labelledby": rest["aria-labelledby"] ?? undefined,
              current,
            }),
          ),
          {
            onpointerenter: () => host.hover(key),
            onpointerleave: () => host.hover(null),
            onpointerdown: () => host.press(key),
            onpointerup: () => host.press(null),
            onpointercancel: () => host.press(null),
          },
        ),
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}><div {...attrs(normalizeProps(host.parts().itemCell()))}>{@render children?.()}</div></div>
{/if}
