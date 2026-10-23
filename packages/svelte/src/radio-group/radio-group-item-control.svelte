<script lang="ts">
import { implicitSubmit, isImeKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import { useCompositeHost, useHostItem } from "../composite-host.svelte"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { useHover, usePress } from "../use-press.svelte"
import { radioGroupContext, radioItemContext } from "./context"
import type { RadioGroupItemControlProps } from "./types"

const { child, children, ...rest }: RadioGroupItemControlProps = $props()
const ctx = radioGroupContext.get()
const item = radioItemContext.get()
const env = useEnvironment()
// The modality tracker must see the pointerdown that comes before focus.
$effect(() => env.modality.subscribe(() => {}))
const el = elementRef("button")
$effect(() => {
  const node = el.current
  const tag = el.tag
  untrack(() => {
    item.controlEl.current = node
    item.setControlTag(tag)
  })
})
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const disabled = () => ctx.disabled() || item.disabled()
const press = usePress({
  env,
  send: (e) => {
    if (e.type === "PRESS") ctx.send({ type: "PRESS", key: item.key(), modality: e.modality })
  },
  disabled,
})
const hover = useHover({ env, send: () => {}, disabled })
// Hosted: the radio is also one of the host's controls (navigation and tab stop).
const host = useCompositeHost()
const hostKey = $derived(ctx.ids().item(item.key()))
useHostItem(
  host,
  // The toolbar has no typeahead: the value is enough to name the registration.
  () => ({ id: hostKey, skip: disabled() && !ctx.focusableWhenDisabled(), textValue: item.key() }),
  () => el.current,
)
const merged = $derived.by(() => {
  const tag = item.controlTag()
  const own = normalizeProps(
    ctx.api(item.pendingStop).itemControl(item.key(), {
      tag,
      focused,
      modality: modality.current,
      pressed: press.pressed,
      hovered: hover.hovered,
      itemDisabled: item.disabled(),
      labelable: tag === "button" || tag === "input",
      labelRendered: item.labelRendered(),
      descriptionRendered: item.descriptionRendered(),
    }),
  )
  const hostProps = host
    ? normalizeProps(
        host.itemProps({ id: hostKey, disabled: disabled(), first: host.claimFirst(hostKey) }),
      )
    : {}
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          own,
          hostProps,
          {
            // Enter submits the form (implicit submission) and never checks; hosted by a
            // toolbar, Enter checks like Space (APG toolbar example) and never submits.
            onkeydown: (e: KeyboardEvent) => {
              if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
              if (!ctx.hosted) {
                implicitSubmit(item.inputEl.current?.form ?? null)
                return
              }
              e.preventDefault()
              if (!disabled() && !e.repeat)
                ctx.send({ type: "PRESS", key: item.key(), modality: "keyboard" })
            },
          },
          press.props,
          hover.props,
          { onfocusin: () => (focused = true), onfocusout: () => (focused = false) },
        ),
        ...el.props,
      },
      rest,
    ),
  )
})
const current = $derived({ checked: ctx.value() === item.key(), disabled: disabled() })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the button's attributes and handlers. -->
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
