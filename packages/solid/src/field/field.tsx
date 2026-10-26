/** @jsxImportSource solid-js */
import {
  announcerCapability,
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
  partId,
  type RegisteredControl,
  registerFormValue,
  validityCapability,
} from "@rind-ui/core"
import type { PartRegistry } from "@rind-ui/core/internal"
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  on,
  onCleanup,
  children as resolve,
  Show,
  splitProps,
  untrack,
  useContext,
} from "solid-js"
import { useFieldsetDisabled } from "../fieldset/context"
import { useFormBinding } from "../form/context"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { usePartRegistry, useRegisterPart, useRenderedId, useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { useModality } from "../use-modality"
import { usePresence } from "../use-presence"
import { FieldControlContext, type FieldRootOptions, fieldRootKeys } from "./context"

declare const process: { env: { NODE_ENV?: string } }

declare module "../provider" {
  interface RindMessageScopes {
    field: FieldMessages
  }
}

interface PartsCtx {
  readonly instance: Accessor<string>
  readonly registry: PartRegistry<FieldPart>
  readonly api: Accessor<ReturnType<typeof fieldConnect>>
  readonly setLabel: (el: Element | null) => void
  readonly control: () => RegisteredControl | null
  readonly hasErrorPart: { current: number }
}
const PartsContext = createContext<PartsCtx>()
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

export type FieldRootProps = Omit<JSX.HTMLAttributes<HTMLDivElement>, "children" | "id"> &
  FieldRootOptions & {
    /** For Field hosts: the scope the Field's parts carry. Default `field`. */
    readonly scope?: string | undefined
    /** For a Field host that is another component's part: its root's part name. */
    readonly rootPart?: string | undefined
    /**
     * For Field hosts: the host's state attributes, read in the root's props only (an accessor,
     * not a spread: a spread would make every prop lookup depend on the host's state).
     */
    readonly attrs?: (() => Record<string, unknown>) | undefined
    readonly render?: RenderProp<FieldState> | undefined
    readonly children?: JSX.Element | ((state: FieldState) => JSX.Element)
  }

function Root(props: FieldRootProps) {
  const [local, rest] = splitProps(props, [
    ...fieldRootKeys,
    "scope",
    "rootPart",
    "attrs",
    "render",
    "children",
  ])
  const env = useEnvironment(announcerCapability, validityCapability)
  const instance = useRootId(() => local.id)
  const messages = useMessages("field", fieldMessages, () => local.messages)
  const fieldsetDisabled = useFieldsetDisabled()
  const disabled = () => local.disabled === true || fieldsetDisabled()
  let labelEl: Element | null = null
  // The Label rendered as another element: the control is named by aria-labelledby.
  const [labelNotNative, setLabelNotNative] = createSignal(false)
  let registered: { control: RegisteredControl; label: string } | null = null
  /** The dirty baseline: the value at the first registration, once per Field. */
  let baseline: { value: unknown } | null = null
  /** Updates the Field (label `for`, listeners) when the registered control changes. */
  const [version, setVersion] = createSignal(0)
  /** The control that claimed the binding first; any other gets none (zag#2475). */
  let owner: string | null = null
  // Inside a Form: its defaults, its server errors by name, and it leads an attempt.
  const form = useFormBinding()
  const validationMode = () => local.validationMode ?? form?.validationMode ?? "submit"
  const validationBehavior = () => local.validationBehavior ?? form?.validationBehavior ?? "native"
  const { view, send, service } = useMachine(
    fieldMachine,
    () => ({
      name: local.name,
      disabled: disabled(),
      readOnly: local.readOnly,
      required: local.required,
      invalid: local.invalid,
      errors: local.errors ?? form?.errorsFor(local.name),
      managed: form !== null,
      validate: local.validate,
      validationMode: validationMode(),
      validationBehavior: validationBehavior(),
      validationDebounce: local.validationDebounce,
      messages: messages(),
      label: () => (labelEl?.textContent ?? "").trim(),
      formValues: () => formValues(registered?.control.validityElement()?.form),
      control: () => registered?.control ?? null,
    }),
    env,
  )
  const registry = usePartRegistry<FieldPart>({ scope: "field", root: instance() })
  const labelId = useRenderedId(registry, "label")
  const descriptionId = useRenderedId(registry, "description")
  const errorId = useRenderedId(registry, "error-message")
  // The modality tracker must see the pointerdown that comes before focus.
  afterMount(() => onCleanup(env.modality.subscribe(() => {})))
  const modality = useModality(env.modality, () => view().context.focused)
  const api = createMemo(() => {
    version()
    return fieldConnect({
      instance: instance(),
      state: view().state,
      context: view().context,
      props: {
        disabled: disabled(),
        readOnly: local.readOnly === true,
        required: local.required === true,
        invalid: local.invalid,
      },
      touched: local.touched,
      dirty: local.dirty,
      modality: modality(),
      control: registered
        ? { id: registered.control.id, labelable: registered.control.labelable }
        : null,
      initial: baseline,
      name: local.name,
      scope: local.scope,
      ...(local.rootPart === undefined ? {} : { rootPart: local.rootPart }),
    })
  })
  const hasErrorPart = { current: 0 }
  // Stable functions: a control re-registers only when it remounts.
  const register = (control: RegisteredControl, label: string) => {
    registered = { control, label }
    baseline ??= { value: control.value() }
    setVersion((v) => v + 1)
    send({ type: "CONTROL.REGISTER", control })
    return () => {
      if (registered?.control.id !== control.id) return
      registered = null
      setVersion((v) => v + 1)
      send({ type: "CONTROL.UNREGISTER", id: control.id })
    }
  }
  const claim = (token: string) => {
    if (owner === null || owner === token) {
      owner = token
      return true
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[rind-ui] field: a second control (${token}) is inside one Field (the first is ${owner}); only the first is wired. Use a Fieldset to group controls.`,
      )
    }
    return false
  }
  const release = (token: string) => {
    if (owner === token) owner = null
  }
  const report = (event: FieldControlReport) => {
    if (event.type === "commit") send({ type: "CONTROL.COMMIT" })
    else
      send({
        type: "CONTROL.CHANGE",
        value: event.value,
        user: event.user,
        composing: event.composing,
      })
  }
  const binding = createMemo<FieldControlBinding>(() => ({
    ids: { label: labelId(), description: descriptionId(), error: errorId() },
    labelNotNative: labelNotNative(),
    data: api().controlData(),
    state: {
      disabled: disabled(),
      readOnly: local.readOnly === true,
      required: local.required === true,
      invalid: api().display === "invalid",
      validationBehavior: validationBehavior(),
    },
    name: local.name,
    controlId: partId("field", instance(), "control"),
    errorMessageAttribute: local.errorMessageAttribute ?? "describedby",
    register,
    report,
    claim,
    release,
  }))
  const [root, setRoot] = createSignal<Element | null>(null)
  afterMount(() => {
    // Focus entering and leaving the Field (layers opened from the control count as inside).
    const el = root()
    if (el) {
      const inside = (target: EventTarget | null) =>
        getLayerStack(el.ownerDocument).isLogicallyInside(target, el)
      const onIn = (e: Event) => {
        if (!inside((e as FocusEvent).relatedTarget))
          send({ type: "FOCUS.ENTER", modality: env.modality.modality() })
      }
      const onOut = (e: Event) => {
        const related = (e as FocusEvent).relatedTarget
        if (related !== null) {
          if (!inside(related)) send({ type: "FOCUS.LEAVE" })
          return
        }
        // No related target: a click on the page background (leaving), or the window
        // losing focus (not leaving). Decided once the focus settled.
        const doc = el.ownerDocument
        env.scheduler.setTimeout(() => {
          if (doc.hasFocus() && !inside(doc.activeElement)) send({ type: "FOCUS.LEAVE" })
        }, 0)
      }
      el.addEventListener("focusin", onIn)
      el.addEventListener("focusout", onOut)
      onCleanup(() => {
        el.removeEventListener("focusin", onIn)
        el.removeEventListener("focusout", onOut)
      })
    }
    // The validity element can change when the control re-registers (`version`).
    createEffect(() => {
      version()
      const name = local.name
      const input = registered?.control.validityElement()
      if (!input) return
      const onInvalid = (e: Event) => {
        // The browser's bubble only when no ErrorMessage part would show the error.
        if (hasErrorPart.current > 0) e.preventDefault()
        send({ type: "INVALID" })
      }
      const owningForm = input.form
      const onReset = (e: Event) => {
        // Who asked is known now, while the reset is being dispatched: a framework reset
        // after a form action keeps the server errors.
        const keepExternal = form?.resetOrigin() === "framework"
        // After the control reset itself, and only if nobody cancelled the reset.
        env.scheduler.setTimeout(() => {
          if (!e.defaultPrevented) send({ type: "RESET", keepExternal })
        }, 0)
      }
      // A submission the browser lets through is still an attempt; inside a Form the
      // Form leads the attempt (one per form, one focus, one summary).
      const onSubmit = () => {
        if (!form) send({ type: "SUBMIT.ATTEMPT" })
      }
      input.addEventListener("invalid", onInvalid)
      owningForm?.addEventListener("reset", onReset)
      owningForm?.addEventListener("submit", onSubmit, true)
      const unregister =
        owningForm && name
          ? registerFormValue(owningForm, name, () => registered?.control.value())
          : undefined
      onCleanup(() => {
        input.removeEventListener("invalid", onInvalid)
        owningForm?.removeEventListener("reset", onReset)
        owningForm?.removeEventListener("submit", onSubmit, true)
        unregister?.()
      })
    })
    // Registered with the Form: it reads the display synchronously (right after an attempt).
    if (form) {
      const off = form.register({
        id: instance(),
        name: local.name,
        element: () => root(),
        attempt: () => send({ type: "SUBMIT.ATTEMPT" }),
        status: () => {
          const snap = service.getSnapshot()
          return snap.state === "validating"
            ? "validating"
            : fieldDisplay(snap.state, snap.context, {
                disabled: disabled(),
                invalid: local.invalid,
              })
        },
        focus: () => registered?.control.focus("keyboard"),
        value: () => registered?.control.value(),
      })
      onCleanup(off)
    }
    // A held submission goes on once this Field's async check settled.
    createEffect(
      on(
        () => view().state === "validating",
        (validating, was) => {
          if (was && !validating) form?.settled()
        },
      ),
    )
  })
  const state = reactive<FieldState>(() => ({
    valid: api().display === "valid",
    invalid: api().display === "invalid",
    validating: view().state === "validating",
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(api().root()),
        ...(local.id === undefined ? {} : { id: local.id }),
        ref: setRoot,
      },
      local.attrs?.() ?? {},
      rest,
    ),
  )
  const children = () => resolveChildren(local.children, state)
  return (
    <FieldControlContext.Provider value={binding}>
      <PartsContext.Provider
        value={{
          instance,
          registry,
          api,
          setLabel: (el) => {
            labelEl = el
            setLabelNotNative(el !== null && el.tagName !== "LABEL")
          },
          control: () => registered?.control ?? null,
          hasErrorPart,
        }}
      >
        {renderPart(local.render, merged, state, children, (p) => (
          <div {...p}>{children()}</div>
        ))}
      </PartsContext.Provider>
    </FieldControlContext.Provider>
  )
}

const stateOf = (ctx: PartsCtx) =>
  reactive<FieldState>(() => ({
    valid: ctx.api().display === "valid",
    invalid: ctx.api().display === "invalid",
    validating: false,
  }))

type PartProps<A> = Omit<A, "children"> & {
  readonly render?: RenderProp<FieldState> | undefined
  readonly children?: JSX.Element | ((state: FieldState) => JSX.Element)
}

function Label(props: PartProps<JSX.LabelHTMLAttributes<HTMLLabelElement>>) {
  const [local, rest] = splitProps(props, ["render", "id", "children"])
  const ctx = useParts("Label")
  const env = useEnvironment()
  const own = () => local.id ?? partId("field", ctx.instance(), "label")
  useRegisterPart(ctx.registry, "label", own)
  let node: Element | null = null
  // A non-labelable control (a group), or a Label that is not a <label> (base-ui#587): named
  // by aria-labelledby; a press focuses the control.
  const interaction = normalizeProps(
    labelInteraction(env, {
      target: () => null,
      forwardsFocus: () =>
        (node !== null && node.tagName !== "LABEL") || ctx.control()?.labelable === false,
      focusTarget: () => ctx.control()?.focus("pointer"),
    }),
  )
  const merged = createMemo(() => {
    const part = ctx.api().label(own())
    return mergeProps(
      {
        ...normalizeProps({
          ...part,
          // Before the control registers (server render) the Field's control id is assumed.
          for: ctx.control() ? part["for"] : partId("field", ctx.instance(), "control"),
        }),
        ...interaction,
        ref: (el: Element) => {
          node = el
          ctx.setLabel(el)
        },
      },
      rest,
    )
  })
  const state = stateOf(ctx)
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => (
    // biome-ignore lint/a11y/noLabelWithoutControl: `for` is the Field's control id
    <label {...p}>{children()}</label>
  ))
}

function Description(props: PartProps<JSX.HTMLAttributes<HTMLParagraphElement>>) {
  const [local, rest] = splitProps(props, ["render", "id", "children"])
  const ctx = useParts("Description")
  const own = () => local.id ?? partId("field", ctx.instance(), "description")
  useRegisterPart(ctx.registry, "description", own)
  const merged = createMemo(() => mergeProps(normalizeProps(ctx.api().description(own())), rest))
  const state = stateOf(ctx)
  const children = () => resolveChildren(local.children, state)
  return renderPart(local.render, merged, state, children, (p) => <p {...p}>{children()}</p>)
}

export type FieldErrorMessageProps = Omit<JSX.HTMLAttributes<HTMLParagraphElement>, "children"> & {
  /** Rendered only when this validity key caused the error (one message per constraint). */
  readonly match?: string | undefined
  readonly render?: RenderProp<FieldState> | undefined
  /** Replaces the default text; a function receives the messages. Empty output falls back. */
  readonly children?: JSX.Element | ((messages: readonly string[]) => JSX.Element)
}

function ErrorMessageShown(
  props: FieldErrorMessageProps & {
    readonly own: string
    readonly setEl: (el: Element | null) => void
  },
) {
  const [local, rest] = splitProps(props, ["own", "setEl", "match", "render", "children"])
  const ctx = useParts("ErrorMessage")
  useRegisterPart(ctx.registry, "error-message", () => local.own)
  const merged = createMemo(() =>
    mergeProps({ ...normalizeProps(ctx.api().errorMessage(local.own)), ref: local.setEl }, rest),
  )
  const fallback = (): JSX.Element => {
    const messages = ctx.api().messages
    return messages.length > 1 ? (
      <ul>
        <For each={messages}>{(m) => <li>{m}</li>}</For>
      </ul>
    ) : (
      messages[0]
    )
  }
  const given = resolve(() => resolveChildren(local.children, ctx.api().messages))
  const children = (): JSX.Element => {
    const value = given()
    const empty =
      value === undefined ||
      value === null ||
      value === false ||
      (Array.isArray(value) && value.length === 0)
    return empty ? fallback() : value
  }
  const state = stateOf(ctx)
  return renderPart(local.render, merged, state, children, (p) => <p {...p}>{children()}</p>)
}

function ErrorMessage(props: FieldErrorMessageProps) {
  const [local, rest] = splitProps(props, ["id", "match"])
  const ctx = useParts("ErrorMessage")
  // Counted while mounted: the Field cancels the browser bubble only when one exists.
  ctx.hasErrorPart.current += 1
  onCleanup(() => {
    ctx.hasErrorPart.current -= 1
  })
  const [el, setEl] = createSignal<Element | null>(null)
  const open = () =>
    ctx.api().display === "invalid" &&
    (local.match === undefined || local.match === ctx.api().errorKey)
  const presence = usePresence(open, el)
  return (
    <Show when={presence.mounted()}>
      <ErrorMessageShown
        {...rest}
        own={local.id ?? partId("field", untrack(ctx.instance), "error-message")}
        setEl={setEl}
      />
    </Show>
  )
}

/** The parts, by name: `field.parts.ts` re-exports them as the `Field` namespace. */
export { Description, ErrorMessage, Label, Root }
