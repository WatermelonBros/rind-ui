<script lang="ts">
import { focusSafely, type NumberInputEvent, type NumberInputTrigger } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import { useFieldBindingPeek } from "../field/context.svelte"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { usePress } from "../use-press.svelte"
import { stateOf, useApi } from "./api.svelte"
import { numberInputContext } from "./context"
import type { NumberInputTriggerProps } from "./types"

const {
  trigger,
  child,
  children,
  ...rest
}: NumberInputTriggerProps & { readonly trigger: NumberInputTrigger } = $props()
const ctx = numberInputContext.get()
const env = useEnvironment()
const apiFor = useApi(ctx, useFieldBindingPeek())
const own = $derived(
  trigger === "increment" ? apiFor().incrementTrigger() : apiFor().decrementTrigger(),
)
const press = usePress({
  env,
  // Pressing never takes focus (press without focus): a mouse moves it to the input.
  focusOnPress: false,
  suppressTouchContextMenu: true,
  disabled: () => own["aria-disabled"] === "true",
  send: (e) => {
    if (
      e.type !== "PRESS.START" &&
      e.type !== "PRESS" &&
      e.type !== "PRESS.END" &&
      e.type !== "PRESS.CANCEL"
    )
      return
    // A mouse press moves focus to the input; touch and stylus never do (a stylus tap must
    // not open the tablet keyboard: base-ui#1528).
    if (e.type === "PRESS.START" && e.pointerType === "mouse") {
      const input = ctx.inputEl.current
      if (input && input.ownerDocument.activeElement !== input)
        void focusSafely(input, env, "programmatic", "pointer")
    }
    ctx.send({
      type: e.type,
      trigger,
      pointerType: e.pointerType,
      modality: e.modality,
    } as NumberInputEvent)
  },
})
// The pointer left a held trigger: repeats stop (the press itself goes on).
let wasPressed = false
$effect(() => {
  const p = press.pressed
  untrack(() => {
    ctx.setPressed(trigger, p)
    const view = ctx.view()
    const holding = view.matches("pressing", "spinning") && view.context.trigger === trigger
    if (wasPressed && !p && holding) ctx.send({ type: "PRESS.LEAVE" })
    wasPressed = p
  })
})
const merged = $derived(stripMarker(mergeProps({ ...normalizeProps(own), ...press.props }, rest)))
const current = $derived(stateOf(ctx))
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the button's attributes and handlers. -->
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
