<script lang="ts">
import { toKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useRegisterItem } from "../use-collection-items.svelte"
import { tagGroupHost, tagGroupTag } from "./context"
import type { TagGroupTagProps } from "./types"

const { value, textValue, disabled, href, child, children, ...rest }: TagGroupTagProps = $props()
const host = tagGroupHost.get()
const key = $derived(toKey(value))
const el = elementRef("div")
const row: { current: Element | null } = { current: null }
$effect(() => {
  row.current = el.current
})
useRegisterItem(
  host.registry,
  () => ({ key: value, textValue, disabled }),
  () => el.current,
)
$effect(() => {
  if (href === undefined) return
  const k = key
  untrack(() => host.mountLink(k, true))
  return () => untrack(() => host.mountLink(k, false))
})
tagGroupTag.set({ key: () => key, href: () => href ?? host.hrefOf(key), row })
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(
          host.parts().item(key, {
            "aria-label": rest["aria-label"] ?? undefined,
            "aria-labelledby": rest["aria-labelledby"] ?? undefined,
          }),
        ),
        ...el.props,
        // Hover for mouse and pen only.
        onpointerenter: (e: PointerEvent) => {
          if (e.pointerType !== "touch") host.hover(key)
        },
        onpointerleave: () => host.hover(null),
        onpointerdown: () => host.press(key),
        onpointerup: () => host.press(null),
        onpointercancel: () => host.press(null),
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
