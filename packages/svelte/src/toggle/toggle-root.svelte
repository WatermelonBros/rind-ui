<script lang="ts">
import {
  accessibleNameOf,
  blurEvent,
  checkStableName,
  focusEvent,
  toggleConnect,
  toggleMachine,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import type { HTMLButtonAttributes } from "svelte/elements"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { useHover, usePress } from "../use-press.svelte"
import { toggleContext } from "./context"
import type { ToggleRootProps, ToggleState } from "./types"

let {
  pressed = $bindable(),
  defaultPressed,
  onPressedChange,
  disabled = false,
  focusableWhenDisabled = false,
  id,
  child,
  children,
  ...rest
}: ToggleRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment()
const el = elementRef("button")
// Not destructured: `view` is a getter, read on every update.
const machine = useMachine(toggleMachine, () => ({
  pressed,
  defaultPressed,
  onPressedChange: (next: boolean, details) => {
    let cancelled = false
    onPressedChange?.(next, {
      ...details,
      cancel() {
        cancelled = true
        details.cancel()
      },
    })
    // `bind:pressed` (or a function binding) receives the accepted change.
    if (!cancelled && pressed !== undefined) pressed = next
  },
}))
const send = machine.send
// A rind-ui Fieldset's context reaches portalled parts; the DOM tracker native fieldsets.
const fieldsetContext = useFieldsetDisabled()
let fieldsetDom = $state(false)
const effectiveDisabled = $derived(disabled || fieldsetContext() || fieldsetDom)
$effect(() => {
  const node = el.current
  // The modality tracker must see the pointerdown that comes before focus.
  const offModality = env.modality.subscribe(() => {})
  if (!node) return offModality
  const watch = watchFieldsetDisabled(node, (d) => (fieldsetDom = d))
  fieldsetDom = watch.disabled
  return () => {
    offModality()
    watch.stop()
  }
})
const on = $derived(machine.view.matches("on"))
// Development: the name must not follow the state (APG Button).
let named: { name: string; on: boolean } | undefined
$effect(() => {
  const current = on
  if (!DEV || !el.current) return
  const next = { name: accessibleNameOf(el.current), on: current }
  checkStableName(named, next)
  named = next
})
const press = usePress({
  env,
  // Only the activation toggles; disabled sends nothing (no guard in the machine).
  send: (e) => {
    // A PressEvent's `type` is the PressEventType union; this one is checked to be "PRESS".
    if (e.type === "PRESS") send(e as Extract<typeof e, { type: "PRESS" }>)
  },
  disabled: () => effectiveDisabled,
})
const hover = useHover({ env, send: () => {}, disabled: () => effectiveDisabled })
const focused = $derived(machine.view.context.focused)
const modality = useModality(env.modality, () => focused)
const api = $derived(
  toggleConnect(
    {
      instance,
      tag: el.tag,
      on,
      disabled: effectiveDisabled,
      focusableWhenDisabled,
      focused,
      modality: modality.current,
      pressed: press.pressed,
      hovered: hover.hovered,
    },
    env,
  ),
)
const current: ToggleState = $derived({ pressed: on, disabled: effectiveDisabled })
toggleContext.set({ api: () => api, state: () => current })
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(normalizeProps(api.root()), press.props, hover.props, {
          onfocusin: (e: FocusEvent) => send(focusEvent(e.currentTarget as Element, env.modality)),
          onfocusout: () => send(blurEvent(env.modality)),
        }),
        ...(id === undefined ? {} : { id }),
        ...el.props,
      },
      rest,
    ),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the button's attributes and handlers. -->
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
