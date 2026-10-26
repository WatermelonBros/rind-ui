import { focusSafely, mergeFieldProps, textFieldConnect } from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { useFieldControl } from "../field/context.svelte"
import { joinHandlers, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useModality } from "../use-modality.svelte"
import { keys, textFieldContext, visibilityInputProps } from "./context"

/**
 * The Input / Textarea logic: Field registration, the control's attributes and handlers.
 * `token` is the part's `$props.id()`; `attrs` its rest props. Read `.props` and `.composing`.
 */
export function useControl(
  part: "input" | "textarea",
  token: string,
  attrs: () => Readonly<Record<string, unknown>>,
) {
  const ctx = textFieldContext.get()
  const binding = useFieldControl(token)
  const env = useEnvironment()
  const controlId = $derived(
    (attrs()["id"] as string | undefined) ?? binding?.().controlId ?? token,
  )
  const el = elementRef(part)
  ctx.controls.current += 1
  $effect(() => () => {
    ctx.controls.current -= 1
  })
  const maxlength = $derived(
    attrs()["maxlength"] === undefined ? undefined : Number(attrs()["maxlength"]),
  )
  // After mount, like React's layout effects: the server render does not know them yet.
  $effect(() => ctx.setMaxLength(maxlength))
  $effect(() => ctx.setControlId(controlId))
  $effect(() => {
    const node = el.current as HTMLInputElement | HTMLTextAreaElement | null
    const id = controlId
    if (!node) return
    return untrack(() => {
      ctx.controlEl.current = node
      // autoFocus: focused before the handlers ran (base-ui#3172).
      if (node.ownerDocument.activeElement === node)
        ctx.send({ type: "FOCUS", modality: env.modality.modality() })
      return binding?.().register(
        {
          id,
          labelable: true,
          focus: (modality) => void focusSafely(node, env, "programmatic", modality),
          validityElement: () => node,
          value: () => node.value,
        },
        id,
      )
    })
  })
  // Development: the placeholder is never a name; a control needs a Label or an ARIA name.
  $effect(() => {
    const node = el.current as HTMLInputElement | null
    if (!DEV || !node) return
    const named =
      (node.labels?.length ?? 0) > 0 ||
      node.hasAttribute("aria-label") ||
      node.hasAttribute("aria-labelledby")
    if (!named) {
      console.warn(
        `[rind-ui] ${ctx.scope}: the ${part} has no accessible name (a placeholder is not one); render a Label or pass aria-label / aria-labelledby.`,
      )
    }
  })
  // A form reset: the DOM value is re-read once the reset ran (the latest defaultValue).
  $effect(() => {
    const node = el.current as HTMLInputElement | null
    const form = node?.form
    if (!node || !form) return
    const onReset = (e: Event) =>
      env.scheduler.setTimeout(() => {
        if (!e.defaultPrevented) ctx.send({ type: "RESET", value: node.value })
      }, 0)
    form.addEventListener("reset", onReset)
    return () => form.removeEventListener("reset", onReset)
  })
  const modality = useModality(env.modality, () => ctx.view().context.focused)
  // The value the Field last heard of: a parent's controlled change is reported too (not a
  // user change), so its validity and data-filled follow (react-spectrum#8659).
  let reported: string | null = null
  $effect(() => {
    const current = ctx.view().values.value ?? ""
    untrack(() => {
      const b = binding?.()
      if (!ctx.controlled() || !b) return
      if (reported === null || reported === current) {
        reported = current
        return
      }
      reported = current
      b.report({ type: "change", value: current, user: false, composing: false })
    })
  })
  const api = $derived.by(() => {
    const a = attrs()
    const field = mergeFieldProps(
      {
        role: "textbox",
        labelable: true,
        disabled: ctx.disabled(),
        readOnly: ctx.readOnly(),
        required: a["required"] === true,
        name: a["name"] as string | undefined,
        consumerDescribedBy: a["aria-describedby"] as string | undefined,
        ariaLabel: a["aria-label"] as string | undefined,
        ariaLabelledBy: a["aria-labelledby"] as string | undefined,
      },
      binding?.() ?? null,
    )
    return textFieldConnect(
      {
        scope: ctx.scope,
        instance: ctx.instance(),
        state: ctx.view().state,
        value: ctx.view().values.value ?? "",
        controlled: ctx.controlled(),
        defaultValue: ctx.defaultValue(),
        focused: ctx.view().context.focused,
        modality: modality.current,
        focusableWhenDisabled: ctx.focusableWhenDisabled(),
        field,
        fieldData: binding?.().data ?? {},
        controlId,
        countId: ctx.countId(),
        limit: ctx.limit(),
        count: ctx.count(),
        clearLabel: ctx.own().type === "search" ? ctx.messages().clearSearch : ctx.messages().clear,
      },
      {
        send: ctx.send,
        report: (event) => {
          if (event.type === "change") {
            ctx.applySoftLimit(String(event.value))
            reported = String(event.value)
          }
          binding?.().report(event)
        },
        takeReason: ctx.takeReason,
      },
    )
  })
  const props = $derived.by(() => {
    const {
      id: _id,
      required: _r,
      name: _n,
      maxlength: _m,
      "aria-describedby": _d,
      "aria-label": ariaLabel,
      "aria-labelledby": _l,
      ...rest
    } = attrs()
    const type = ctx.own().type
    const own = normalizeProps({ ...api.control(part), maxlength, "aria-label": ariaLabel })
    // The preset's input attributes win; its handlers run after Text Field's.
    const preset = normalizeProps({
      ...(type !== undefined && type !== "password" && type !== "search" ? { type } : {}),
      ...keys(ctx).input(),
      ...visibilityInputProps(ctx),
    })
    return stripMarker(mergeProps({ ...joinHandlers(own, preset), ...el.props }, rest))
  })
  return {
    get props() {
      return props
    },
    get composing() {
      return api.composing
    },
    el,
    ctx,
  }
}
