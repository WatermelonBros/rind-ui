<script lang="ts">
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"
import { isOpen, menuApi, menuHost, menuLevel } from "./context.svelte"
import type { MenuTriggerProps } from "./types"

const { disabled = false, child, children, ...rest }: MenuTriggerProps = $props()
const ctx = menuLevel.get()
const host = menuHost.maybe() ?? null
const env = useEnvironment()
// The modality tracker needs a subscriber while the trigger is mounted.
$effect(() => env.modality.subscribe(() => {}))
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const press = usePress({
  env,
  send: (e) => {
    if (e.type !== "PRESS") return
    // A menubar opens its menus itself (one open menu per bar).
    const key = host?.key?.()
    if (ctx.inMenubar && key !== undefined) ctx.tree.parentPress(key, e.modality)
    else menuApi(ctx, env).pressTrigger(e.modality)
  },
  disabled: () => disabled === true,
  // A label's forwarded click focuses the trigger and never opens the menu.
  labelActivation: "focus",
})
const tagName = ctx.inMenubar ? "div" : "button"
const el = elementRef(tagName)
$effect(() => {
  const node = el.current
  ctx.shared.trigger = node instanceof HTMLElement ? node : null
})
const merged = $derived.by(() => {
  const own = normalizeProps(
    menuApi(ctx, env).trigger({
      focused,
      modality: modality.current,
      pressed: press.pressed,
      tag: el.tag,
      disabled: disabled === true,
      tabIndex: host?.tabIndex?.(),
    }),
  )
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(own, press.props, {
          onfocus: () => {
            focused = true
          },
          onblur: () => {
            focused = false
          },
        }),
        ...el.props,
      },
      rest,
    ),
  )
})
const current = $derived({ open: isOpen(ctx) })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <svelte:element this={tagName} {...merged as HTMLAttributes<HTMLElement>}>{@render children?.(current)}</svelte:element>
{/if}
