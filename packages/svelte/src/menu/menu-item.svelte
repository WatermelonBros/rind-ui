<script lang="ts">
import { linkProps } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { menuApi, menuLevel, useItem } from "./context.svelte"
import type { MenuItemProps } from "./types"

const {
  value,
  textValue,
  disabled = false,
  closeOnSelect = true,
  onSelect,
  href,
  target,
  rel,
  download,
  routerOptions,
  child,
  children,
  ...rest
}: MenuItemProps = $props()
const ctx = menuLevel.get()
const env = useEnvironment()
const uid = $props.id()
const link = $derived(href !== undefined)
const el = elementRef(() => (href !== undefined ? "a" : "div"))
const key = useItem(
  ctx,
  () => ({ value, textValue, disabled }),
  () => ({ onSelect }),
  () => el.current,
  uid,
)
const merged = $derived.by(() => {
  const api = menuApi(ctx, env)
  const linkPart = link
    ? linkProps(
        {
          href,
          target: target ?? undefined,
          rel,
          download,
          routerOptions,
          disabled,
          focusableWhenDisabled: true,
          origin: typeof location === "undefined" ? undefined : location.origin,
          tag: el.tag,
          onActivate: (a) => {
            if (a.disposition === "same-tab") api.activateLink(key(), a.modality, closeOnSelect)
          },
        },
        env,
      )
    : {}
  // The menu owns the role, focus and highlight; the link part only its navigation.
  const { role: _role, tabindex: _tabindex, ...navigation } = linkPart
  const own = api.item(key(), { kind: link ? "link-item" : "item", disabled, closeOnSelect })
  return stripMarker(
    mergeProps(
      { ...joinHandlers(normalizeProps(own), normalizeProps(navigation)), ...el.props },
      rest,
    ),
  )
})
const current = $derived({ highlighted: ctx.view().context.highlightedKey === key(), disabled })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <svelte:element this={link ? "a" : "div"} {...merged as HTMLAttributes<HTMLElement>}>{@render children?.(current)}</svelte:element>
{/if}
