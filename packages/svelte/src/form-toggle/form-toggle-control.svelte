<script lang="ts">
import { blurEvent, focusEvent, implicitSubmit, isImeKey } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import type { HTMLButtonAttributes } from "svelte/elements"
import { elementRef } from "../element-ref.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useHover, usePress } from "../use-press.svelte"
import { formToggleContext, stateOf, useApi } from "./context.svelte"
import type { FormToggleControlProps } from "./types"

const { child, children, ...rest }: FormToggleControlProps = $props()
const ctx = formToggleContext.get()
const env = useEnvironment()
// The modality tracker must see the pointerdown that comes before focus.
$effect(() => env.modality.subscribe(() => {}))
const el = elementRef("button")
$effect(() => {
  const node = el.current
  untrack(() => {
    ctx.controlEl.current = node
    ctx.setControlTag(el.tag)
  })
})
const disabled = () => ctx.own().disabled || ctx.binding?.().state.disabled === true
const press = usePress({
  env,
  // Only the activation toggles; PRESS.* drive data-pressed.
  send: (e) => {
    if (e.type === "PRESS") ctx.service.send({ type: "TOGGLE", modality: e.modality })
  },
  disabled,
})
const hover = useHover({ env, send: () => {}, disabled })
const apiFor = useApi(ctx)
const api = $derived(
  apiFor({
    pressed: press.pressed,
    hovered: hover.hovered,
    describedBy: rest["aria-describedby"] ?? undefined,
    ariaLabel: rest["aria-label"] ?? undefined,
    ariaLabelledBy: rest["aria-labelledby"] ?? undefined,
  }),
)
const own = $derived(normalizeProps({ ...api.control(), ...ctx.grouped()?.props.control }))
// Grouped: the group needs the rendered Control's id (aria-controls) and disabled flag.
// Through primitive deriveds: they notify only when the value changes (the group's props
// object is new on every change of the group, which would re-register in a loop).
const groupRegister = $derived(ctx.grouped()?.register)
const controlDisabled = $derived(own["disabled"] === true || own["aria-disabled"] === "true")
$effect(() => {
  const register = groupRegister
  const node = el.current
  const isDisabled = controlDisabled
  if (!register || !node) return
  return untrack(() => register(node.id, isDisabled))
})
const merged = $derived.by(() => {
  const { "aria-describedby": _d, "aria-labelledby": _l, ...consumer } = rest
  return stripMarker(
    mergeProps(
      {
        ...joinHandlers(
          own,
          {
            // Enter submits the form (implicit submission); it never toggles. Before press,
            // which prevents Enter's native click; a consumer's preventDefault (its handlers
            // run first) still cancels the submission.
            onkeydown: (e: KeyboardEvent) => {
              if (e.key !== "Enter" || e.defaultPrevented || isImeKey(e)) return
              implicitSubmit(ctx.inputEl.current?.form ?? null)
            },
          },
          press.props,
          hover.props,
          {
            onfocusin: (e: FocusEvent) =>
              ctx.service.send(focusEvent(e.currentTarget as Element, env.modality)),
            onfocusout: () => ctx.service.send(blurEvent(env.modality)),
          },
        ),
        ...el.props,
      },
      consumer,
    ),
  )
})
const current = $derived(stateOf(ctx, api))
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <!-- Connect's props are the button's attributes and handlers. -->
  <button {...merged as HTMLButtonAttributes}>{@render children?.(current)}</button>
{/if}
