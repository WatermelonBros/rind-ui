import {
  focusSafely,
  injectStyle,
  type MessageOverrides,
  type PasswordInputEvent,
  type PasswordInputHideReason,
  type PasswordInputMessages,
  passwordInputConnect,
  passwordInputMachine,
  passwordInputMessages,
  passwordRevealStyle,
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
import { HostDescription, HostErrorMessage, HostLabel } from "../field/use-field-host"
import { joinHandlers } from "../join-handlers"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { type RenderProp, renderPart } from "../render"
import {
  createTextFieldRoot,
  TextField,
  type TextFieldHostConfig,
  type TextFieldHostContext,
  type TextFieldRootProps,
  useTextFieldHost,
} from "../text-field/text-field"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"

declare const process: { env: { NODE_ENV?: string } }

declare module "../provider" {
  interface RindMessageScopes {
    "password-input": PasswordInputMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect

export type PasswordInputVisibilityReason = "PRESS" | PasswordInputHideReason

export interface PasswordInputVisibilityDetails {
  readonly reason: PasswordInputVisibilityReason
}

export interface PasswordInputRootProps extends TextFieldRootProps {
  readonly visible?: boolean
  readonly defaultVisible?: boolean
  readonly onVisibleChange?: (visible: boolean, details: PasswordInputVisibilityDetails) => void
  readonly messages?: MessageOverrides<PasswordInputMessages>
}

/** The host's view of this preset's machine: `visible` and the preset's messages. */
function preset(ctx: TextFieldHostContext) {
  return {
    // Sound: this host was created with `passwordInputMachine` (the config below), whose
    // values include `visible`, and its messages default to `passwordInputMessages`.
    visible: (ctx.view.values as unknown as { readonly visible: boolean }).visible,
    messages: ctx.messages as PasswordInputMessages,
    // Sound: the same service accepts the preset's events (merged by name at runtime).
    send: ctx.send as unknown as (event: PasswordInputEvent) => void,
  }
}

const config: TextFieldHostConfig = {
  scope: "password-input",
  // Sound: the host reads only Text Field's part of the machine; the preset's own values
  // and events are read and sent through `preset()` above.
  machine: passwordInputMachine as unknown as TextFieldHostConfig["machine"],
  messages: passwordInputMessages,
  label: "PasswordInput",
  ownProps: ["visible", "defaultVisible", "onVisibleChange"],
  machineProps: (own, { controlEl, env, pendingSelection }) => {
    const onVisibleChange = own["onVisibleChange"] as PasswordInputRootProps["onVisibleChange"]
    return {
      visible: own["visible"],
      defaultVisible: own["defaultVisible"],
      onVisibleChange: onVisibleChange
        ? (visible: boolean, details: unknown) => {
            const e = (details as { event: { type: string; reason?: PasswordInputHideReason } })
              .event
            onVisibleChange(visible, {
              reason: e.type === "VISIBILITY.HIDE" ? (e.reason ?? "SUBMIT") : "PRESS",
            })
          }
        : undefined,
      keepSelection: (selection: readonly [number, number]) => {
        pendingSelection.current = selection
      },
      watchForm: (on: { readonly submit: () => void; readonly reset: () => void }) => {
        const form = controlEl.current?.form
        if (!form) return () => {}
        const onSubmit = () => {
          const el = controlEl.current
          // The browser builds the form data (and a password manager reads it) right after
          // this event: the input is a password input by then, whatever React renders next.
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
  },
  rootData: (ctx) => passwordInputConnect(connectInput(ctx)).root(),
  inputProps: (ctx) => passwordInputConnect(connectInput(ctx)).input(),
  afterRender: (ctx) => {
    // Same frame as the `type` change: the caret stays where the user left it.
    const selection = ctx.pendingSelection.current
    ctx.pendingSelection.current = null
    const el = ctx.controlEl.current
    if (selection && el && el.ownerDocument.activeElement === el) {
      el.setSelectionRange(selection[0], selection[1])
    }
  },
}

/** The `type` React rendered last (the `data-state` it carries agrees with it). */
const renderedType = (el: HTMLInputElement) =>
  el.getAttribute("data-state") === "visible" ? "text" : "password"

function connectInput(ctx: TextFieldHostContext) {
  const p = preset(ctx)
  return {
    scope: ctx.scope,
    instance: ctx.instance,
    visible: p.visible,
    disabled: ctx.disabled || ctx.focusableWhenDisabled,
    controlId: ctx.controlId ?? "",
    fieldData: {},
    toggleLabel: p.messages.toggleLabel,
    customReveal: ctx.mounted.triggers > 0,
  }
}

const Root = createTextFieldRoot<PasswordInputRootProps>(config)

function VisibilityTrigger({
  render,
  ref,
  ...rest
}: ComponentPropsWithRef<"button"> & { readonly render?: RenderProp<{ visible: boolean }> }) {
  const ctx = useTextFieldHost("PasswordInput.VisibilityTrigger")
  const env = useEnvironment()
  // Peek, never claim: the Input is the Field's one control.
  const binding = useFieldBindingPeek()
  const p = preset(ctx)
  const el = useRef<HTMLButtonElement | null>(null)
  const { setMounted } = ctx
  useIsoLayoutEffect(() => {
    injectStyle(el.current?.ownerDocument, "password-input-reveal", passwordRevealStyle, env)
    setMounted("triggers", 1)
    return () => setMounted("triggers", -1)
  }, [setMounted, env])
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
        `[rind-ui] password-input: the VisibilityTrigger's name changed with its state ("${lastName.current}" → "${name}"); keep one name, aria-pressed carries the state.`,
      )
    }
    lastName.current = name
  }, [visible])
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const api = passwordInputConnect({
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

function Indicator({
  render,
  ...rest
}: Omit<ComponentPropsWithRef<"span">, "children"> & {
  readonly children?: ReactNode
  readonly render?: RenderProp<{ visible: boolean }>
}) {
  const ctx = useTextFieldHost("PasswordInput.Indicator")
  // Peek, never claim: the Input is the Field's one control.
  const binding = useFieldBindingPeek()
  const p = preset(ctx)
  const api = passwordInputConnect({ ...connectInput(ctx), fieldData: binding?.data ?? {} })
  return renderPart("span", mergeProps(normalizeProps(api.indicator()), rest), render, {
    visible: p.visible,
  })
}

export const PasswordInput = {
  Root,
  Label: HostLabel,
  Description: HostDescription,
  ErrorMessage: HostErrorMessage,
  Input: TextField.Input,
  VisibilityTrigger,
  Indicator,
  ClearTrigger: TextField.ClearTrigger,
  CharacterCount: TextField.CharacterCount,
}
