import {
  type FieldControlBinding,
  type FieldControlReport,
  type FieldMessages,
  type FieldPart,
  fieldConnect,
  fieldDisplay,
  fieldMachine,
  fieldMessages,
  formValues,
  getLayerStack,
  labelInteraction,
  type MessageOverrides,
  partId,
  type RegisteredControl,
  registerFormValue,
  type Validate,
  type ValidationBehavior,
  type ValidationMode,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { useFieldsetDisabled } from "../fieldset/fieldset"
import { type FormBinding, useFormBinding } from "../form/form"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import {
  type PartRegistry,
  usePartRegistry,
  useRegisterPart,
  useRenderedId,
  useRootId,
} from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"

declare const process: { env: { NODE_ENV?: string } }

declare module "../provider" {
  interface RindMessageScopes {
    field: FieldMessages
  }
}

/** The binding a rind-ui form control reads in its Root (field-control). */
const FieldControlContext = createContext<FieldControlBinding | null>(null)

/** Whether an enclosing Field exists (a Field host then joins it instead of creating one). */
export function useIsInsideField(): boolean {
  return useContext(FieldControlContext) !== null
}

/** The enclosing Field's binding without claiming it (a host's root reads its state). */
export function useFieldBindingPeek(): FieldControlBinding | null {
  return useContext(FieldControlContext)
}

/** For control authors: the enclosing Field's binding, or null outside a Field. */
export function useFieldControl(): FieldControlBinding | null {
  const binding = useContext(FieldControlContext)
  const token = useId()
  // One control per Field: the first to claim the binding gets it, others get none.
  const owns = binding?.claim(token) ?? false
  useEffect(() => () => binding?.release(token), [binding, token])
  return owns ? binding : null
}

interface PartsCtx {
  readonly instance: string
  readonly registry: PartRegistry<FieldPart>
  readonly api: ReturnType<typeof fieldConnect>
  readonly label: () => Element | null
  readonly setLabel: (el: Element | null) => void
  readonly control: () => RegisteredControl | null
  readonly hasErrorPart: { current: number }
}
const PartsContext = createContext<PartsCtx | null>(null)

function useParts(part: string): PartsCtx {
  const ctx = useContext(PartsContext)
  if (!ctx) throw new Error(`Field.${part} must be inside Field.Root`)
  return ctx
}

export interface FieldState {
  readonly valid: boolean
  readonly invalid: boolean
  readonly validating: boolean
}

export type FieldRootProps = Omit<ComponentPropsWithRef<"div">, "children"> & {
  readonly children?: ReactNode
  readonly name?: string
  readonly disabled?: boolean
  readonly readOnly?: boolean
  readonly required?: boolean
  /** `true` forces invalid, `false` forces valid, `undefined` validates. */
  readonly invalid?: boolean
  /** Controlled flags. */
  readonly touched?: boolean
  readonly dirty?: boolean
  /** External errors (server errors): shown at once, cleared by the next change. */
  readonly errors?: readonly string[]
  readonly validate?: Validate
  /** Default "submit". */
  readonly validationMode?: ValidationMode
  /** Default "native". */
  readonly validationBehavior?: ValidationBehavior
  readonly validationDebounce?: number
  /** "both" adds `aria-errormessage` to `aria-describedby`. */
  readonly errorMessageAttribute?: "describedby" | "both"
  readonly messages?: MessageOverrides<FieldMessages>
  readonly render?: RenderProp<FieldState>
  /**
   * For Field hosts (Text Field, …): the scope the Field's parts carry, so a host's Label
   * is `data-scope="text-field"`. Default `field`.
   */
  readonly scope?: string
}

function Root({
  name,
  disabled: ownDisabled = false,
  readOnly = false,
  required = false,
  invalid,
  touched,
  dirty,
  errors,
  validate,
  validationMode: ownMode,
  validationBehavior: ownBehavior,
  validationDebounce,
  errorMessageAttribute = "describedby",
  messages: ownMessages,
  render,
  scope,
  id,
  ref,
  children,
  ...rest
}: FieldRootProps) {
  const env = useEnvironment()
  const instance = useRootId(id)
  const messages = useMessages("field", fieldMessages, ownMessages)
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled = ownDisabled || fieldsetDisabled
  const labelEl = useRef<Element | null>(null)
  const registered = useRef<{ control: RegisteredControl; label: string } | null>(null)
  /** The dirty baseline: the value at the first registration, once per Field. */
  const baseline = useRef<{ value: unknown } | null>(null)
  /** Re-renders the Field (label `for`, listeners) when the registered control changes. */
  const [version, setVersion] = useState(0)
  /** The control that claimed the binding first; any other gets none (zag#2475). */
  const owner = useRef<string | null>(null)
  // Inside a Form: its defaults, its server errors by name, and it leads an attempt.
  const form = useFormBinding()
  const validationMode = ownMode ?? form?.validationMode ?? "submit"
  const validationBehavior = ownBehavior ?? form?.validationBehavior ?? "native"
  const latest = useRef({ disabled, invalid })
  latest.current = { disabled, invalid }
  const { view, send, service } = useMachine(fieldMachine, {
    name,
    disabled,
    readOnly,
    required,
    invalid,
    errors: errors ?? form?.errorsFor(name),
    managed: form !== null,
    validate,
    validationMode,
    validationBehavior,
    validationDebounce,
    messages,
    label: () => (labelEl.current?.textContent ?? "").trim(),
    formValues: () => formValues(registered.current?.control.validityElement()?.form),
    control: () => registered.current?.control ?? null,
  })
  const registry = usePartRegistry<FieldPart>({ scope: "field", root: instance })
  const labelId = useRenderedId(registry, "label")
  const descriptionId = useRenderedId(registry, "description")
  const errorId = useRenderedId(registry, "error-message")
  // The modality tracker must see the pointerdown that comes before focus.
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const modality = useModality(env.modality, view.context.focused)
  const api = fieldConnect({
    instance,
    state: view.state,
    context: view.context,
    props: { disabled, readOnly, required, invalid },
    touched,
    dirty,
    modality,
    control: registered.current
      ? { id: registered.current.control.id, labelable: registered.current.control.labelable }
      : null,
    initial: baseline.current,
    name,
    scope,
  })
  const hasErrorPart = useRef(0)
  const controlId = partId("field", instance, "control")
  // Same object while the attributes are the same, so the binding stays stable.
  const dataKey = JSON.stringify(api.controlData())
  const controlData = useMemo(() => JSON.parse(dataKey) as FieldControlBinding["data"], [dataKey])
  // Stable: a control re-registers only when it remounts, not on every Field render.
  const register = useCallback(
    (control: RegisteredControl, label: string) => {
      registered.current = { control, label }
      baseline.current ??= { value: control.value() }
      setVersion((v) => v + 1)
      send({ type: "CONTROL.REGISTER", control })
      return () => {
        if (registered.current?.control.id !== control.id) return
        registered.current = null
        setVersion((v) => v + 1)
        send({ type: "CONTROL.UNREGISTER", id: control.id })
      }
    },
    [send],
  )
  const claim = useCallback((token: string) => {
    if (owner.current === null || owner.current === token) {
      owner.current = token
      return true
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[rind-ui] field: a second control (${token}) is inside one Field (the first is ${owner.current}); only the first is wired. Use a Fieldset to group controls.`,
      )
    }
    return false
  }, [])
  const release = useCallback((token: string) => {
    if (owner.current === token) owner.current = null
  }, [])
  const report = useCallback(
    (event: FieldControlReport) => {
      if (event.type === "commit") send({ type: "CONTROL.COMMIT" })
      else
        send({
          type: "CONTROL.CHANGE",
          value: event.value,
          user: event.user,
          composing: event.composing,
        })
    },
    [send],
  )
  const binding: FieldControlBinding = useMemo(
    () => ({
      ids: { label: labelId, description: descriptionId, error: errorId },
      data: controlData,
      state: {
        disabled,
        readOnly,
        required,
        invalid: api.display === "invalid",
        validationBehavior,
      },
      name,
      controlId,
      errorMessageAttribute,
      register,
      report,
      claim,
      release,
    }),
    [
      controlData,
      labelId,
      descriptionId,
      errorId,
      disabled,
      readOnly,
      required,
      api.display,
      validationBehavior,
      name,
      controlId,
      errorMessageAttribute,
      register,
      report,
      claim,
      release,
    ],
  )
  const root = useRef<HTMLElement | null>(null)
  useFieldListeners(root, send, version, registered, hasErrorPart, name, form)
  // Registered with the Form: it reads the display synchronously (right after an attempt).
  useEffect(() => {
    if (!form) return
    return form.register({
      id: instance,
      name,
      element: () => root.current,
      attempt: () => send({ type: "SUBMIT.ATTEMPT" }),
      status: () => {
        const snap = service.getSnapshot()
        return snap.state === "validating"
          ? "validating"
          : fieldDisplay(snap.state, snap.context, latest.current)
      },
      focus: () => registered.current?.control.focus("keyboard"),
      value: () => registered.current?.control.value(),
    })
  }, [form, instance, name, send, service])
  // A held submission goes on once this Field's async check settled.
  const wasValidating = useRef(false)
  useEffect(() => {
    const validating = view.state === "validating"
    if (wasValidating.current && !validating) form?.settled()
    wasValidating.current = validating
  }, [view.state, form])
  const parts: PartsCtx = {
    instance,
    registry,
    api,
    label: () => labelEl.current,
    setLabel: (el) => {
      labelEl.current = el
    },
    control: () => registered.current?.control ?? null,
    hasErrorPart,
  }
  const props = mergeProps(
    {
      ...normalizeProps(api.root()),
      ...(id === undefined ? {} : { id }),
      ref: composeRefs(root, ref),
    },
    rest,
  )
  return (
    <FieldControlContext value={binding}>
      <PartsContext value={parts}>
        {renderPart("div", { ...props, children }, render, {
          valid: api.display === "valid",
          invalid: api.display === "invalid",
          validating: view.state === "validating",
        })}
      </PartsContext>
    </FieldControlContext>
  )
}

type Send = ReturnType<typeof useMachine<typeof fieldMachine>>["send"]

/**
 * Focus entering and leaving the Field (layers opened from the control count as inside),
 * the native `invalid` event on the validity element (cancelled iff an ErrorMessage part
 * is rendered), the form's `reset`, and the form-values registration.
 */
function useFieldListeners(
  root: { readonly current: HTMLElement | null },
  send: Send,
  version: number,
  registered: { readonly current: { readonly control: RegisteredControl } | null },
  hasErrorPart: { readonly current: number },
  name: string | undefined,
  formBinding: FormBinding | null,
) {
  const env = useEnvironment()
  useEffect(() => {
    const el = root.current
    if (!el) return
    const inside = (target: EventTarget | null) =>
      getLayerStack(el.ownerDocument).isLogicallyInside(target, el)
    const onIn = (e: FocusEvent) => {
      if (!inside(e.relatedTarget)) send({ type: "FOCUS.ENTER", modality: env.modality.modality() })
    }
    const onOut = (e: FocusEvent) => {
      if (e.relatedTarget !== null) {
        if (!inside(e.relatedTarget)) send({ type: "FOCUS.LEAVE" })
        return
      }
      // No related target: a click on the page background (leaving), or the window losing
      // focus (not leaving). Decided once the focus settled.
      const doc = el.ownerDocument
      env.scheduler.setTimeout(() => {
        if (doc.hasFocus() && !inside(doc.activeElement)) send({ type: "FOCUS.LEAVE" })
      }, 0)
    }
    el.addEventListener("focusin", onIn)
    el.addEventListener("focusout", onOut)
    return () => {
      el.removeEventListener("focusin", onIn)
      el.removeEventListener("focusout", onOut)
    }
  }, [root, send, env])
  // The validity element can change when the control re-registers (`version`).
  // biome-ignore lint/correctness/useExhaustiveDependencies: version marks a re-registration
  useEffect(() => {
    const input = registered.current?.control.validityElement()
    if (!input) return
    const onInvalid = (e: Event) => {
      // The browser's bubble only when no ErrorMessage part would show the error.
      if (hasErrorPart.current > 0) e.preventDefault()
      send({ type: "INVALID" })
    }
    const form = input.form
    const onReset = (e: Event) => {
      // Who asked is known now, while the reset is being dispatched (add-form): a framework
      // reset after a form action keeps the server errors.
      const keepExternal = formBinding?.resetOrigin() === "framework"
      // After the control reset itself, and only if nobody cancelled the reset.
      env.scheduler.setTimeout(() => {
        if (!e.defaultPrevented) send({ type: "RESET", keepExternal })
      }, 0)
    }
    // A submission the browser lets through (aria behaviour, or a valid form) is still an
    // attempt: errors display from then on.
    // Inside a Form the Form leads the attempt (one per form, one focus, one summary).
    const onSubmit = () => {
      if (!formBinding) send({ type: "SUBMIT.ATTEMPT" })
    }
    input.addEventListener("invalid", onInvalid)
    form?.addEventListener("reset", onReset)
    form?.addEventListener("submit", onSubmit, true)
    const unregister =
      form && name
        ? registerFormValue(form, name, () => registered.current?.control.value())
        : undefined
    return () => {
      input.removeEventListener("invalid", onInvalid)
      form?.removeEventListener("reset", onReset)
      form?.removeEventListener("submit", onSubmit, true)
      unregister?.()
    }
  }, [version, send, env, hasErrorPart, name, registered, formBinding])
}

type PartProps<T extends keyof React.JSX.IntrinsicElements> = ComponentPropsWithRef<T> & {
  readonly render?: RenderProp<FieldState>
}

const stateOf = (ctx: PartsCtx): FieldState => ({
  valid: ctx.api.display === "valid",
  invalid: ctx.api.display === "invalid",
  validating: false,
})

function Label({ render, id, ref, ...rest }: PartProps<"label">) {
  const ctx = useParts("Label")
  const env = useEnvironment()
  const own = id ?? partId("field", ctx.instance, "label")
  useRegisterPart(ctx.registry, "label", own)
  const control = ctx.control()
  // A non-labelable control (a group) is named by aria-labelledby; a press focuses it.
  const interaction = labelInteraction(env, {
    target: () => null,
    forwardsFocus: () => ctx.control()?.labelable === false,
    focusTarget: () => ctx.control()?.focus("pointer"),
  })
  const part = ctx.api.label(own)
  const props = mergeProps(
    {
      ...normalizeProps({
        ...part,
        // Before the control registers (server render) the Field's control id is assumed.
        for: control ? part["for"] : partId("field", ctx.instance, "control"),
      }),
      ...interaction,
      ref: composeRefs(ctx.setLabel, ref),
    },
    rest,
  )
  return renderPart("label", props, render, stateOf(ctx))
}

function Description({ render, id, ...rest }: PartProps<"p">) {
  const ctx = useParts("Description")
  const own = id ?? partId("field", ctx.instance, "description")
  useRegisterPart(ctx.registry, "description", own)
  const props = mergeProps(normalizeProps(ctx.api.description(own)), rest)
  return renderPart("p", props, render, stateOf(ctx))
}

export type FieldErrorMessageProps = Omit<PartProps<"p">, "children"> & {
  /** Rendered only when this validity key caused the error (one message per constraint). */
  readonly match?: string
  /** Replaces the default text; a function returning null/undefined falls back to it. */
  readonly children?: ReactNode | ((messages: readonly string[]) => ReactNode)
}

function ErrorMessage({ render, id, match, children, ...rest }: FieldErrorMessageProps) {
  const ctx = useParts("ErrorMessage")
  // Counted while mounted: the Field cancels the browser bubble only when one exists.
  useEffect(() => {
    ctx.hasErrorPart.current += 1
    return () => {
      ctx.hasErrorPart.current -= 1
    }
  }, [ctx.hasErrorPart])
  const open = ctx.api.display === "invalid" && (match === undefined || match === ctx.api.errorKey)
  const el = useRef<HTMLElement | null>(null)
  const presence = usePresence(open, el)
  const own = id ?? partId("field", ctx.instance, "error-message")
  return presence.mounted ? (
    <ErrorMessageShown ctx={ctx} own={own} el={el} render={render} content={children} rest={rest} />
  ) : null
}

function ErrorMessageShown({
  ctx,
  own,
  el,
  render,
  content: children,
  rest,
}: {
  readonly ctx: PartsCtx
  readonly own: string
  readonly el: { current: HTMLElement | null }
  readonly render: RenderProp<FieldState> | undefined
  readonly content: FieldErrorMessageProps["children"]
  readonly rest: Record<string, unknown>
}) {
  useRegisterPart(ctx.registry, "error-message", own)
  const messages = ctx.api.messages
  const fallback =
    messages.length > 1 ? (
      <ul>
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    ) : (
      messages[0]
    )
  const given = typeof children === "function" ? children(messages) : children
  const content = given === null || given === undefined ? fallback : given
  const props = mergeProps(
    { ...normalizeProps(ctx.api.errorMessage(own)), ref: el, children: content },
    rest,
  )
  return renderPart("p", props, render, stateOf(ctx))
}

export const Field = { Root, Label, Description, ErrorMessage }
