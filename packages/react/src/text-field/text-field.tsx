import {
  autosize as attachAutosize,
  buildTextFieldMachine,
  defaultCount,
  type FieldMessages,
  focusSafely,
  type MessageOverrides,
  mergeFieldProps,
  type TextFieldDetails,
  type TextFieldMessages,
  type TextFieldReason,
  textFieldConnect,
  textFieldMessages,
  type Validate,
  type ValidationBehavior,
  type ValidationMode,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import { useFieldBindingPeek, useFieldControl } from "../field/field"
import { FieldHost, HostDescription, HostErrorMessage, HostLabel } from "../field/use-field-host"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePress } from "../use-press"

declare const process: { env: { NODE_ENV?: string } }

declare module "../provider" {
  interface RindMessageScopes {
    "text-field": TextFieldMessages
  }
}

const useIsoLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect
const { machine: textFieldMachine } = buildTextFieldMachine({})

interface Ctx {
  readonly scope: string
  readonly instance: string
  readonly view: ReturnType<typeof useMachine<typeof textFieldMachine>>["view"]
  readonly send: ReturnType<typeof useMachine<typeof textFieldMachine>>["send"]
  readonly controlled: boolean
  readonly defaultValue: string | undefined
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly focusableWhenDisabled: boolean
  readonly messages: TextFieldMessages
  readonly limit: number | undefined
  readonly count: ((value: string) => number) | undefined
  readonly countId: string | undefined
  /** Writes the soft-limit validity for `value` (before the Field sees the change). */
  readonly applySoftLimit: (value: string) => void
  readonly setCount: (state: CountState | null) => void
  readonly setMaxLength: (n: number | undefined) => void
  readonly controlEl: { current: HTMLInputElement | HTMLTextAreaElement | null }
  readonly takeReason: () => TextFieldReason | undefined
  readonly controls: { current: number }
}
interface CountState {
  readonly id: string
  readonly max: number | undefined
  readonly count: ((value: string) => number) | undefined
}

const TextFieldContext = createContext<Ctx | null>(null)
function useTextField(part: string): Ctx {
  const ctx = useContext(TextFieldContext)
  if (!ctx) throw new Error(`TextField.${part} must be inside TextField.Root`)
  return ctx
}

export type TextFieldRootProps = Omit<ComponentPropsWithRef<"div">, "children" | "defaultValue"> & {
  readonly children?: ReactNode
  readonly value?: string | null
  readonly defaultValue?: string
  readonly onValueChange?: (value: string, details: TextFieldDetails) => void
  /** Disabled but focusable: read-only + aria-disabled; nothing changes the value. */
  readonly focusableWhenDisabled?: boolean
  /** Announce the count when this many or fewer characters remain. */
  readonly countThreshold?: number
  readonly messages?: MessageOverrides<TextFieldMessages>
  // Field props (the Root is a Field when not inside one).
  readonly name?: string
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly required?: boolean
  readonly invalid?: boolean
  readonly errors?: readonly string[]
  readonly validate?: Validate
  readonly validationMode?: ValidationMode
  readonly validationBehavior?: ValidationBehavior
  readonly validationDebounce?: number
  readonly fieldMessages?: MessageOverrides<FieldMessages>
}

function Root({
  value,
  defaultValue,
  onValueChange,
  focusableWhenDisabled = false,
  countThreshold,
  messages: ownMessages,
  fieldMessages: ownFieldMessages,
  children,
  id,
  ...fieldProps
}: TextFieldRootProps) {
  const scope = "text-field"
  const env = useEnvironment()
  const generated = useId()
  const instance = id ?? generated
  const messages = useMessages("text-field", textFieldMessages, ownMessages)
  const enclosing = useFieldBindingPeek()
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled =
    fieldProps.disabled === true || enclosing?.state.disabled === true || fieldsetDisabled
  const readOnly = fieldProps.readOnly === true || enclosing?.state.readOnly === true
  const [countState, setCount] = useState<CountState | null>(null)
  const [maxLength, setMaxLength] = useState<number | undefined>(undefined)
  const limit = maxLength ?? countState?.max
  const controlEl = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const reason = useRef<TextFieldReason | undefined>(undefined)
  const controls = useRef(0)
  const latestOnChange = useRef(onValueChange)
  latestOnChange.current = onValueChange
  const { view, send } = useMachine(textFieldMachine, {
    value: value === undefined ? undefined : (value ?? ""),
    defaultValue: defaultValue ?? "",
    onValueChange: (v, details) => {
      // Machine details → the public ones (reason, native event, isComposing).
      const e = (
        details as {
          event: { type: string; reason?: string; event?: Event | null; composing?: boolean }
        }
      ).event
      latestOnChange.current?.(v, {
        reason: e.type === "RESET" ? "RESET" : (e.reason ?? "INPUT"),
        event: e.event ?? null,
        isComposing: e.composing === true,
      })
    },
    disabled,
    readOnly,
    focusableWhenDisabled,
    limit,
    threshold: countThreshold,
    count: countState?.count,
    messages,
    id: instance,
    // The only DOM write: the native setter, then one bubbling `input` event, which comes
    // back as an ordinary INPUT carrying this reason (base-ui#4643).
    clearInput: (why, focus) => {
      const el = controlEl.current
      if (!el) return
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set
      reason.current = why
      setter?.call(el, "")
      el.dispatchEvent(new Event("input", { bubbles: true }))
      reason.current = undefined
      if (focus && el.ownerDocument.activeElement !== el) void focusSafely(el, env, "programmatic")
    },
  })
  const modality = useModality(env.modality, view.context.focused)
  // Exactly one Input or Textarea (development error otherwise).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && controls.current !== 1) {
      console.error(
        `[rind-ui] text-field: renders ${controls.current} Input/Textarea parts; exactly one is required.`,
      )
    }
  }, [])
  // A soft limit is a control-owned validity message (the Field displays it). Written from
  // the new value synchronously, before the change is reported, so validation never lags.
  const softSet = useRef(false)
  const applySoftLimit = (next: string) => {
    const el = controlEl.current
    const max = countState?.max
    if (!el || max === undefined) return
    const used = (countState?.count ?? defaultCount)(next)
    if (used > max) {
      el.setCustomValidity(messages.charactersOver(used - max))
      softSet.current = true
    } else if (softSet.current) {
      el.setCustomValidity("")
      softSet.current = false
    }
  }
  const ctx: Ctx = {
    scope,
    instance,
    view,
    send,
    controlled: value !== undefined,
    defaultValue,
    disabled,
    readOnly,
    focusableWhenDisabled,
    messages,
    limit,
    count: countState?.count,
    countId: countState?.id,
    applySoftLimit,
    setCount,
    setMaxLength,
    controlEl,
    takeReason: () => reason.current,
    controls,
  }
  const rootData = {
    "data-focus": view.context.focused ? "" : undefined,
    "data-focus-visible":
      view.context.focused && modality !== "pointer" && modality !== "touch" ? "" : undefined,
    "data-composing": view.matches("composing") ? "" : undefined,
  }
  return (
    <FieldHost
      scope={scope}
      id={instance}
      {...fieldProps}
      {...(ownFieldMessages ? { messages: ownFieldMessages } : {})}
      {...rootData}
    >
      <TextFieldContext value={ctx}>{children}</TextFieldContext>
    </FieldHost>
  )
}

type ControlProps<T extends "input" | "textarea"> = Omit<
  ComponentPropsWithRef<T>,
  "value" | "defaultValue"
> & {
  readonly render?: RenderProp<{ composing: boolean }>
}

function useControl<T extends "input" | "textarea">(part: T, props: ControlProps<T>) {
  const ctx = useTextField(part === "input" ? "Input" : "Textarea")
  const binding = useFieldControl()
  const env = useEnvironment()
  const generated = useId()
  const {
    id,
    ref,
    render,
    required,
    name,
    maxLength,
    "aria-describedby": describedBy,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    ...rest
  } = props as ControlProps<"input">
  const controlId = id ?? binding?.controlId ?? generated
  const el = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  useIsoLayoutEffect(() => {
    ctx.controls.current += 1
    return () => {
      ctx.controls.current -= 1
    }
  }, [ctx.controls])
  useIsoLayoutEffect(() => ctx.setMaxLength(maxLength), [maxLength, ctx.setMaxLength])
  const register = binding?.register
  useIsoLayoutEffect(() => {
    ctx.controlEl.current = el.current
    // autoFocus: focused before React's handlers ran (base-ui#3172).
    if (el.current && el.current.ownerDocument.activeElement === el.current) {
      ctx.send({ type: "FOCUS", modality: env.modality.modality() })
    }
    if (!register) return
    return register(
      {
        id: controlId,
        labelable: true,
        focus: (modality) => {
          if (el.current) void focusSafely(el.current, env, "programmatic", modality)
        },
        validityElement: () => el.current,
        value: () => el.current?.value ?? "",
      },
      controlId,
    )
  }, [register, controlId, env])
  // Development: the placeholder is never a name; a control needs a Label or an ARIA name.
  useEffect(() => {
    const node = el.current
    if (process.env.NODE_ENV === "production" || !node) return
    const named =
      (node.labels?.length ?? 0) > 0 ||
      node.hasAttribute("aria-label") ||
      node.hasAttribute("aria-labelledby")
    if (!named) {
      console.warn(
        `[rind-ui] ${ctx.scope}: the ${part} has no accessible name (a placeholder is not one); render a Label or pass aria-label / aria-labelledby.`,
      )
    }
  }, [ctx.scope, part])
  // A form reset: the DOM value is re-read once the reset ran (the latest defaultValue).
  useEffect(() => {
    const form = el.current?.form
    if (!form) return
    const onReset = (e: Event) =>
      env.scheduler.setTimeout(() => {
        if (!e.defaultPrevented && el.current) ctx.send({ type: "RESET", value: el.current.value })
      }, 0)
    form.addEventListener("reset", onReset)
    return () => form.removeEventListener("reset", onReset)
  }, [ctx.send, env])
  const field = mergeFieldProps(
    {
      role: "textbox",
      labelable: true,
      disabled: ctx.disabled,
      readOnly: ctx.readOnly,
      required,
      name,
      consumerDescribedBy: describedBy,
      ariaLabel,
      ariaLabelledBy,
    },
    binding,
  )
  const modality = useModality(env.modality, ctx.view.context.focused)
  const api = textFieldConnect(
    {
      scope: ctx.scope,
      instance: ctx.instance,
      state: ctx.view.state,
      value: ctx.view.values.value ?? "",
      controlled: ctx.controlled,
      defaultValue: ctx.defaultValue,
      focused: ctx.view.context.focused,
      modality,
      focusableWhenDisabled: ctx.focusableWhenDisabled,
      field,
      fieldData: binding?.data ?? {},
      controlId,
      countId: ctx.countId,
      limit: ctx.limit,
      count: ctx.count,
      clearLabel: ctx.messages.clear,
    },
    {
      send: ctx.send,
      report: (event) => {
        if (event.type === "change") ctx.applySoftLimit(String(event.value))
        binding?.report(event)
      },
      takeReason: ctx.takeReason,
    },
  )
  const merged = mergeProps(
    {
      ...normalizeProps({ ...api.control(part), maxlength: maxLength, "aria-label": ariaLabel }),
      ref: composeRefs(el, ref),
    },
    rest,
  )
  return { merged, render, el, api, ctx }
}

function Input(props: ControlProps<"input">) {
  const { merged, render, api } = useControl("input", props)
  return renderPart("input", merged, render, { composing: api.composing })
}

function Textarea({
  autosize = false,
  ...props
}: ControlProps<"textarea"> & { readonly autosize?: boolean }) {
  const { merged, render, el, api, ctx } = useControl("textarea", props)
  const env = useEnvironment()
  const handle = useRef<ReturnType<typeof attachAutosize> | null>(null)
  useIsoLayoutEffect(() => {
    if (!autosize || !(el.current instanceof HTMLTextAreaElement)) return
    const a = attachAutosize(el.current, env)
    handle.current = a
    return () => {
      a.dispose()
      handle.current = null
    }
  }, [autosize, env])
  // Every value commit (controlled, programmatic, reset) re-measures (kobalte#484).
  const value = ctx.view.values.value
  useIsoLayoutEffect(() => {
    void value
    handle.current?.measure()
  }, [value])
  return renderPart("textarea", merged, render, { composing: api.composing })
}

function ClearTrigger({
  render,
  ...rest
}: ComponentPropsWithRef<"button"> & {
  readonly render?: RenderProp<undefined>
}) {
  const ctx = useTextField("ClearTrigger")
  const env = useEnvironment()
  const press = usePress({
    env,
    // Pressing never moves focus away from the input.
    focusOnPress: false,
    send: (e) => {
      if (e.type === "PRESS") ctx.send({ type: "CLEAR", modality: e.modality, reason: "CLEAR" })
    },
  })
  const value = ctx.view.values.value ?? ""
  const clearable = !ctx.disabled && !ctx.readOnly && !ctx.focusableWhenDisabled && value !== ""
  if (!clearable) return null
  const own = normalizeProps({
    "data-scope": ctx.scope,
    "data-part": "clear-trigger",
    "data-instance": ctx.instance,
    type: "button",
    "aria-label": ctx.messages.clear,
    tabindex: -1,
  })
  return renderPart("button", mergeProps({ ...own, ...press.props }, rest), render, undefined)
}

function CharacterCount({
  max,
  count,
  render,
  id,
  ...rest
}: Omit<ComponentPropsWithRef<"span">, "children"> & {
  /** A soft limit: going over it is a `tooLong`-style error, never a truncation. */
  readonly max?: number
  /** Replaces the counter (default: UTF-16 code units, a line break counts once). */
  readonly count?: (value: string) => number
  readonly render?: RenderProp<undefined>
}) {
  const ctx = useTextField("CharacterCount")
  const own = id ?? `${ctx.scope}-${ctx.instance}-character-count`.replace(/:/g, "")
  useIsoLayoutEffect(() => {
    ctx.setCount({ id: own, max, count })
    return () => ctx.setCount(null)
  }, [own, max, count, ctx.setCount])
  const value = ctx.view.values.value ?? ""
  const used = (count ?? defaultCount)(value)
  const limit = ctx.limit
  const over = limit !== undefined && used > limit
  // On mount and when the limit or counter changes (a change writes it before reporting).
  useEffect(() => {
    ctx.applySoftLimit(ctx.controlEl.current?.value ?? "")
  }, [ctx.applySoftLimit, ctx.controlEl])
  const props = mergeProps(
    normalizeProps({
      "data-scope": ctx.scope,
      "data-part": "character-count",
      "data-instance": ctx.instance,
      id: own,
      "data-over-limit": over ? "" : undefined,
    }),
    rest,
  )
  return renderPart(
    "span",
    { ...props, children: limit === undefined ? used : `${used}/${limit}` },
    render,
    undefined,
  )
}

export const TextField = {
  Root,
  Label: HostLabel,
  Description: HostDescription,
  ErrorMessage: HostErrorMessage,
  Input,
  Textarea,
  ClearTrigger,
  CharacterCount,
}
export type { TextFieldDetails }
