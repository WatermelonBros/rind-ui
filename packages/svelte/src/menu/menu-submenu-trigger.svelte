<script lang="ts">
import { menuIds } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useRegisterItem } from "../use-collection-items.svelte"
import { isOpen, menuApi, menuLevel, menuSubmenu } from "./context.svelte"
import type { MenuSubmenuTriggerProps } from "./types"

const { textValue, disabled = false, child, children, ...rest }: MenuSubmenuTriggerProps = $props()
const sub = menuSubmenu.maybe()
const level = menuLevel.get()
if (!sub) throw new Error("Menu.SubmenuTrigger must be inside Menu.Submenu")
const env = useEnvironment()
const el = elementRef("div")
useRegisterItem(
  sub.parent.registry,
  () => ({ key: sub.key, textValue, disabled }),
  () => el.current,
)
$effect.pre(() => {
  sub.disabled.current = disabled
})
$effect(() => {
  const node = el.current
  sub.shared.trigger = node instanceof HTMLElement ? node : null
})
let focused = $state(false)
const hover = level.hoverIntent.triggerProps((e) => level.service.send(e))
const merged = $derived.by(() => {
  const own = menuApi(sub.parent, env).submenuTrigger(sub.key, {
    disabled,
    focused,
    open: isOpen(level),
    contentId: menuIds(level.levelId).content,
    contentMounted: level.shared.contentMounted,
  })
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(own),
          disabled
            ? {}
            : normalizeProps({
                onPointerMove: hover.onPointerMove,
                onPointerLeave: hover.onPointerLeave,
              }),
          {
            onfocus: () => {
              focused = true
            },
            onblur: () => {
              focused = false
            },
            onclick: (e: MouseEvent) => {
              if (disabled) {
                e.preventDefault()
                return
              }
              // Pointer, assistive technology, and Enter / Space (the level clicks the item).
              level.service.send({ type: "TRIGGER_PRESS", modality: env.modality.modality() })
            },
          },
        ),
        ...el.props,
      },
      rest,
    ),
  )
})
const current = $derived({
  highlighted: sub.parent.view().context.highlightedKey === sub.key,
  disabled,
})
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
