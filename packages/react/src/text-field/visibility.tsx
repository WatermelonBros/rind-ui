// Text Field visibility (`type="password"`): machine props, Root / Input attributes, the
// caret restore after the `type` change, and the VisibilityTrigger / VisibilityIndicator.

import {
  focusSafely,
  injectStyle,
  type TextFieldOwnEvent,
  type TextFieldVisibilityHideReason,
  textFieldRevealStyle,
  textFieldVisibilityConnect,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useFieldBindingPeek } from "../field/field"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"
import {
  type TextFieldHostContext,
  type TextFieldHostRefs,
  type TextFieldRootProps,
  useTextFieldHost,
} from "./text-field"

declare const process: { env: { NODE_ENV?: string } }

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export const isPassword = (ctx: TextFieldHostContext) => ctx.own["type"] === "password"

/** The host's view of visibility: the machine's `visible` and the visibility events. */
function visibilityOf(ctx: TextFieldHostContext) {
  return {
    // Sound: the Text Field machine has the `visible` value (its visibility preset).
    visible: (ctx.view.values as unknown as { readonly visible: boolean }).visible,
    // Sound: the same service accepts the preset's events (merged by name at runtime).
    send: ctx.send as unknown as (event: TextFieldOwnEvent) => void,
  }
}

/** The `type` React rendered last (the `data-state` it carries agrees with it). */
const renderedType = (el: HTMLInputElement) =>
  el.getAttribute("data-state") === "visible" ? "text" : "password"

/** Machine props for visibility; the form watch only for `type="password"`. */
export function visibilityMachineProps(
  own: Readonly<Record<string, unknown>>,
  { controlEl, env, pendingSelection }: TextFieldHostRefs,
) {
  const onVisibleChange = own["onVisibleChange"] as TextFieldRootProps["onVisibleChange"]
  return {
    visible: own["visible"],
    defaultVisible: own["defaultVisible"],
    onVisibleChange: onVisibleChange
      ? (visible: boolean, details: unknown) => {
          const e = (details as { event: { type: string; reason?: TextFieldVisibilityHideReason } })
            .event
          onVisibleChange(visible, {
            reason: e.type === "VISIBILITY.HIDE" ? (e.reason ?? "SUBMIT") : "PRESS",
          })
        }
      : undefined,
    keepSelection: (selection: readonly [number, number]) => {
      pendingSelection.current = selection
    },
    watchForm:
      own["type"] !== "password"
        ? undefined
        : (on: { readonly submit: () => void; readonly reset: () => void }) => {
            const form = controlEl.current?.form
            if (!form) return () => {}
            const onSubmit = () => {
              const el = controlEl.current
              // The browser builds the form data (and a password manager reads it) right
              // after this event: the input is a password input by then.
              if (el instanceof HTMLInputElement && el.type !== "password") {
                el.type = "password"
                env.scheduler.setTimeout(() => {
                  if (controlEl.current === el) el.type = renderedType(el)
                }, 0)
              }
              on.submit()
            }
            // The consumer may prevent the reset in a later listener: read it once dispatch ends.
            const onReset = (e: Event) =>
              env.scheduler.setTimeout(() => {
                if (!e.defaultPrevented) on.reset()
              }, 0)
            form.addEventListener("submit", onSubmit)
            form.addEventListener("reset", onReset)
            return () => {
              form.removeEventListener("submit", onSubmit)
              form.removeEventListener("reset", onReset)
            }
          },
  }
}

function connectInput(ctx: TextFieldHostContext) {
  return {
    scope: ctx.scope,
    instance: ctx.instance,
    visible: visibilityOf(ctx).visible,
    disabled: ctx.disabled || ctx.focusableWhenDisabled,
    controlId: ctx.controlId ?? "",
    fieldData: {},
    toggleLabel: ctx.messages.toggleLabel,
    customReveal: ctx.mounted.triggers > 0,
  }
}

export const visibilityRootData = (ctx: TextFieldHostContext) =>
  isPassword(ctx) ? textFieldVisibilityConnect(connectInput(ctx)).root() : {}

export const visibilityInputProps = (ctx: TextFieldHostContext) =>
  isPassword(ctx) ? textFieldVisibilityConnect(connectInput(ctx)).input() : {}

/** Same frame as the `type` change: the caret stays where the user left it. */
export function visibilityAfterRender(ctx: TextFieldHostContext) {
  const selection = ctx.pendingSelection.current
  ctx.pendingSelection.current = null
  const el = ctx.controlEl.current
  if (selection && el && el.ownerDocument.activeElement === el) {
    el.setSelectionRange(selection[0], selection[1])
  }
}

export function VisibilityTrigger({
  render,
  ref,
  ...rest
}: ComponentPropsWithRef<"button"> & { readonly render?: RenderProp<{ visible: boolean }> }) {
  const ctx = useTextFieldHost("TextField.VisibilityTrigger")
  const env = useEnvironment()
  // Peek, never claim: the Input is the Field's one control.
  const binding = useFieldBindingPeek()
  const p = visibilityOf(ctx)
  const el = useRef<HTMLButtonElement | null>(null)
  const { setMounted } = ctx
  useIsoLayoutEffect(() => {
    injectStyle(el.current?.ownerDocument, "text-field-reveal", textFieldRevealStyle, env)
    setMounted("triggers", 1)
    return () => setMounted("triggers", -1)
  }, [setMounted, env])
  // Development: the trigger belongs to a password field.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && !isPassword(ctx)) {
      console.warn(
        '[rind-ui] text-field: a VisibilityTrigger needs `type="password"` on TextField.Root.',
      )
    }
  }, [ctx])
  const selection = useRef<readonly [number, number] | null>(null)
  const press = usePress({
    env,
    // Mouse and pen leave focus in the input; touch moves it nowhere (the keyboard stays).
    focusOnPress: false,
    disabled: () => ctx.disabled || ctx.focusableWhenDisabled,
    send: (e) => {
      const input = ctx.controlEl.current
      if (!input) return
      const focusedNow = () => input.ownerDocument.activeElement === input
      if (e.type === "PRESS.START") {
        selection.current =
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
      p.send({
        type: "VISIBILITY.TOGGLE",
        modality: e.modality,
        inputFocused,
        selection: selection.current,
      })
      selection.current = null
    },
  })
  // Development: the name must not follow the state (the pressed state says it).
  const lastName = useRef<string | null>(null)
  const visible = p.visible
  useEffect(() => {
    void visible
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node) return
    const name = node.getAttribute("aria-label") ?? node.textContent ?? ""
    if (lastName.current !== null && lastName.current !== name) {
      console.warn(
        `[rind-ui] text-field: the VisibilityTrigger's name changed with its state ("${lastName.current}" → "${name}"); keep one name, aria-pressed carries the state.`,
      )
    }
    lastName.current = name
  }, [visible])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const api = textFieldVisibilityConnect({
    ...connectInput(ctx),
    fieldData: binding?.data ?? {},
    triggerFocused: focused,
    modality,
  })
  const own = normalizeProps({
    ...api.trigger(),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  })
  return renderPart(
    "button",
    mergeProps({ ...joinHandlers(own, press.props), ref: composeRefs(el, ref) }, rest),
    render,
    { visible: p.visible },
  )
}

export function VisibilityIndicator({
  render,
  ...rest
}: Omit<ComponentPropsWithRef<"span">, "children"> & {
  readonly children?: ReactNode
  readonly render?: RenderProp<{ visible: boolean }>
}) {
  const ctx = useTextFieldHost("TextField.VisibilityIndicator")
  // Peek, never claim: the Input is the Field's one control.
  const binding = useFieldBindingPeek()
  const p = visibilityOf(ctx)
  const api = textFieldVisibilityConnect({ ...connectInput(ctx), fieldData: binding?.data ?? {} })
  return renderPart("span", mergeProps(normalizeProps(api.indicator()), rest), render, {
    visible: p.visible,
  })
}
