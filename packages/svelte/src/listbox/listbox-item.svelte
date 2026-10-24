<script lang="ts">
import { toKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterItem } from "../use-collection-items.svelte"
import { listboxHost, listboxItem, listboxSection } from "./context"
import type { ListboxItemProps } from "./types"

const INTERACTIVE =
  "a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true']"
const { value, textValue, disabled, keywords, child, children, ...rest }: ListboxItemProps =
  $props()
const host = listboxHost.get()
const key = $derived(toKey(value))
const section = listboxSection.maybe()
const el = elementRef("div")
useRegisterItem(
  host.registry,
  () => ({ key: value, textValue, disabled, keywords, section }),
  () => el.current,
)
listboxItem.set(() => key)
// Development: no interactive element inside an option.
$effect(() => {
  const node = el.current
  if (!DEV || !node) return
  const nested = node.querySelector(INTERACTIVE)
  if (nested) {
    console.warn(
      `[rind-ui] ${host.name}: the item "${untrack(() => value)}" contains an interactive <${nested.tagName.toLowerCase()}>; options cannot hold controls.`,
    )
  }
})
const own = $derived(host.parts().item(key))
// Virtualized: the highlighted item mounts after the scroll. Focus left on the list, or
// dropped to the body when the previous item unmounted, moves to it while the list is the
// focused composite.
const highlighted = $derived(own["data-highlighted"] !== undefined)
$effect(() => {
  const on = highlighted
  const node = el.current
  untrack(() => {
    const listFocused = host.parts().list()["data-focus"] !== undefined
    const doc = node?.ownerDocument
    const active = doc?.activeElement
    const onList = active?.getAttribute("role") === "listbox" && active.contains(node ?? null)
    const dropped = active === doc?.body || active === null
    if (on && listFocused && node instanceof HTMLElement && (onList || dropped))
      node.focus({ preventScroll: true })
  })
})
const isListed = $derived(!host.listed || host.listed(key))
const merged = $derived(stripMarker(mergeProps({ ...normalizeProps(own), ...el.props }, rest)))
</script>

{#if !isListed}
  <div {...el.props} hidden data-scope={own["data-scope"]} data-part="item">{@render children?.()}</div>
{:else if child}
  {@render child({ props: merged, state: undefined })}
{:else}
  <div {...attrs(merged)}>{@render children?.()}</div>
{/if}
