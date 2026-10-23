<script lang="ts">
import {
  focusSafely,
  injectStyle,
  textFieldRevealStyle,
  textFieldVisibilityConnect,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { useFieldBindingPeek } from "../field/context.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { usePress } from "../use-press.svelte"
import { connectInput, isPassword, textFieldContext, visibilityOf } from "./context"
import type { TextFieldVisibilityTriggerProps } from "./types"

const { child, children, ...rest }: TextFieldVisibilityTriggerProps = $props()
const ctx = textFieldContext.get()
const env = useEnvironment()
// Peek, never claim: the Input is the Field's one control.
const binding = useFieldBindingPeek()
const el = elementRef("button")
$effect(() =>
  untrack(() => {
    injectStyle(el.current?.ownerDocument, "text-field-reveal", textFieldRevealStyle, env)
    ctx.setMounted("triggers", 1)
    // Development: the trigger belongs to a password field.
    if (DEV && !isPassword(ctx))
      console.warn(
        '[rind-ui] text-field: a VisibilityTrigger needs `type="password"` on TextField.Root.',
      )
    return () => ctx.setMounted("triggers", -1)
  }),
)
const visible = $derived(visibilityOf(ctx).visible)
// Development: the name must not follow the state (the pressed state says it).
let lastName: string | null = null
$effect(() => {
  void visible
  const node = el.current
  if (!DEV || !node) return
  const name = node.getAttribute("aria-label") ?? node.textContent ?? ""
  if (lastName !== null && lastName !== name) {
    console.warn(
      `[rind-ui] text-field: the VisibilityTrigger's name changed with its state ("${lastName}" → "${name}"); keep one name, aria-pressed carries the state.`,
    )
  }
  lastName = name
})
let selection: readonly [number, number] | null = null
const press = usePress({
  env,
  // Mouse and pen leave focus in the input; touch moves it nowhere (the keyboard stays).
  focusOnPress: false,
  disabled: () => ctx.disabled() || ctx.focusableWhenDisabled(),
  send: (e) => {
    const input = ctx.controlEl.current
    if (!input) return
    const focusedNow = () => input.ownerDocument.activeElement === input
    if (e.type === "PRESS.START") {
      selection =
        focusedNow() && input.selectionStart !== null && input.selectionEnd !== null
          ? [input.selectionStart, input.selectionEnd]
          : null
      return
    }
    if (e.type !== "PRESS") return
    let inputFocused = focusedNow()
    if ((e.pointerType === "mouse" || e.pointerType === "pen") && !inputFocused) {
      void focusSafely(input, env, "programmatic")
      inputFocused = true
    }
    visibilityOf(ctx).send({
      type: "VISIBILITY.TOGGLE",
      modality: e.modality,
      inputFocused,
      selection,
    })
    selection = null
  },
})
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
const merged = $derived.by(() => {
  const api = textFieldVisibilityConnect({
    ...connectInput(ctx),
    fieldData: binding?.().data ?? {},
    triggerFocused: focused,
    modality: modality.current,
  })
  const own = normalizeProps({
    ...api.trigger(),
    onFocusIn: () => (focused = true),
    onFocusOut: () => (focused = false),
  })
  return stripMarker(mergeProps({ ...joinHandlers(own, press.props), ...el.props }, rest))
})
</script>

{#if child}
  {@render child({ props: merged, state: { visible } })}
{:else}
  <button {...merged as HTMLButtonAttributes}>{@render children?.({ visible })}</button>
{/if}
