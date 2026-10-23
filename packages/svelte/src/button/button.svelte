<script lang="ts">
import {
  announcerCapability,
  blurEvent,
  buttonConnect,
  buttonMachine,
  buttonMessages,
  focusAttrs,
  focusEvent,
  warnInteractiveContent,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { useHover, usePress } from "../use-press.svelte"
import type { ButtonProps, ButtonState } from "./types"

const {
  type,
  disabled = false,
  focusableWhenDisabled = false,
  pending = false,
  focusOnPress,
  href,
  onPress,
  onPressStart,
  onPressEnd,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: ButtonProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment(announcerCapability)
const messages = useMessages("button", buttonMessages, () => ownMessages)
const el = elementRef(() => (href === undefined ? "button" : "a"))
// A rind-ui Fieldset's context reaches portalled parts; the DOM tracker native fieldsets.
const fieldsetContext = useFieldsetDisabled()
const machine = useMachine(
  buttonMachine,
  () => ({
    // The machine guards activation on it as on the prop.
    disabled: disabled || fieldsetContext(),
    pending,
    onPress,
    onPressStart,
    onPressEnd,
    messages: messages(),
    id: instance,
  }),
  env,
)
const send = machine.send
const effectiveDisabled = $derived(
  disabled || machine.view.context.fieldsetDisabled || fieldsetContext(),
)
// Server and hydration render without it, like React's server snapshot.
let origin = $state<string | undefined>(undefined)
$effect(() => {
  origin = globalThis.location?.origin
  // The modality tracker must see the pointerdown that comes before focus.
  return env.modality.subscribe(() => {})
})
$effect(() => {
  const node = el.current
  if (!node) return
  warnInteractiveContent(node, "button")
  const watch = watchFieldsetDisabled(node, (d) => send({ type: "FIELDSET.CHANGE", disabled: d }))
  if (watch.disabled) send({ type: "FIELDSET.CHANGE", disabled: true })
  return watch.stop
})
const press = usePress({
  env,
  // Button opts into neither long press nor a context menu of its own.
  send: (e) => {
    if (e.type !== "CONTEXT_MENU" && e.type !== "LONG_PRESS") send(e)
  },
  disabled: () => effectiveDisabled || pending,
  // Read once, like the press handle it configures.
  ...untrack(() => (focusOnPress === undefined ? {} : { focusOnPress })),
})
const hover = useHover({ env, send: () => {}, disabled: () => effectiveDisabled })
const focused = $derived(machine.view.context.focused)
const modality = useModality(env.modality, () => focused)
const current: ButtonState = $derived({
  pending,
  disabled: effectiveDisabled,
  pressed: press.pressed,
  hovered: hover.hovered,
  focusVisible: focusAttrs(focused, modality.current)["data-focus-visible"] !== undefined,
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          normalizeProps(
            buttonConnect(
              {
                instance,
                tag: el.tag,
                href,
                origin,
                disabled: effectiveDisabled,
                focusableWhenDisabled,
                pending,
                type,
                focused,
                modality: modality.current,
                pressed: press.pressed,
                hovered: hover.hovered,
              },
              env,
            ),
          ),
          press.props,
          hover.props,
          {
            onfocusin: (e: FocusEvent) =>
              send(focusEvent(e.currentTarget as Element, env.modality)),
            onfocusout: () => send(blurEvent(env.modality)),
          },
        ),
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
{:else if href !== undefined}
  <!-- Connect's props are the anchor's attributes and handlers. -->
  <a {...merged as HTMLAnchorAttributes}>{@render children?.(current)}</a>
{:else}
  <!-- Connect's props are the button's attributes and handlers. -->
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
