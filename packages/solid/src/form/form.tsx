/** @jsxImportSource solid-js */
import {
  announcerCapability,
  type FormErrors,
  type FormField,
  type FormMessages,
  type FormSubmitDetails,
  formConnect,
  formMachine,
  formMessages,
  type MessageOverrides,
  type ValidationBehavior,
  type ValidationMode,
} from "@rind-ui/core"
import { createMemo, createSignal, type JSX, onCleanup, splitProps } from "solid-js"
import { afterMount } from "../lifecycle"
import { mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, reactive, renderPart, resolveChildren } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { type FormBinding, FormContext } from "./context"

declare module "../provider" {
  interface RindMessageScopes {
    form: FormMessages
  }
}

/** The imperative API (`actionsRef`). */
export interface FormActions {
  /** Validates every Field (or the one named): errors are displayed; nothing is focused. */
  validate(name?: string): void
}

export interface FormState {
  readonly invalid: boolean
  readonly validating: boolean
}

export type FormRootProps = Omit<JSX.FormHTMLAttributes<HTMLFormElement>, "children"> & {
  /** The form's content (its Fields and controls). */
  readonly children?: JSX.Element | ((state: FormState) => JSX.Element)
  /** Default mode for the Fields inside. */
  readonly validationMode?: ValidationMode | undefined
  /** Default behaviour for the Fields inside; `aria` adds `novalidate`. */
  readonly validationBehavior?: ValidationBehavior | undefined
  /** Server errors by Field name (exact name: `items.0.name` matches as a string). */
  readonly errors?: FormErrors | undefined
  /** Replaces the native submission: typed values of every named Field. */
  readonly onFormSubmit?:
    | ((values: Readonly<Record<string, unknown>>, details: FormSubmitDetails) => void)
    | undefined
  readonly messages?: MessageOverrides<FormMessages> | undefined
  /** Receives the imperative `validate(name?)` once, when the Root is created. */
  readonly actionsRef?: ((actions: FormActions) => void) | undefined
  readonly render?: RenderProp<FormState> | undefined
}

function Root(props: FormRootProps) {
  const [own, rest] = splitProps(props, [
    "validationMode",
    "validationBehavior",
    "errors",
    "onFormSubmit",
    "messages",
    "actionsRef",
    "render",
    "children",
  ])
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(() => rest.id)
  const messages = useMessages("form", formMessages, () => own.messages)
  const fields = new Set<FormField>()
  const [el, setEl] = createSignal<Element | null>(null)
  const form = () => {
    const node = el()
    return node instanceof HTMLFormElement ? node : null
  }
  const { view, send } = useMachine(
    formMachine,
    () => ({
      validationMode: own.validationMode,
      validationBehavior: own.validationBehavior,
      errors: own.errors,
      onFormSubmit: own.onFormSubmit,
      messages: messages(),
      fields: () => [...fields],
      // After the current machine step: the new submit is then handled (and cancelled or
      // replaced by onFormSubmit) while it is being dispatched.
      requestSubmit: (submitter: HTMLElement | null | undefined) =>
        queueMicrotask(() => form()?.requestSubmit(submitter ?? undefined)),
    }),
    env,
  )
  // Normalised once per `errors` object, so an update never re-applies cleared errors.
  const byName = createMemo(() => {
    const out = new Map<string, readonly string[]>()
    for (const [name, m] of Object.entries(own.errors ?? {}))
      out.set(name, typeof m === "string" ? [m] : m)
    return out
  })
  // Getters: the Fields read the Form's current props.
  const binding: FormBinding = {
    get validationMode() {
      return own.validationMode
    },
    get validationBehavior() {
      return own.validationBehavior
    },
    errorsFor: (name) => (name === undefined ? undefined : byName().get(name)),
    register(field) {
      fields.add(field)
      return () => fields.delete(field)
    },
    settled: () => send({ type: "FIELD.SETTLED" }),
    // Solid has no framework-driven form reset: every reset is the user's.
    resetOrigin: () => "user",
  }
  own.actionsRef?.({
    validate(name) {
      if (name === undefined) return send({ type: "VALIDATE" })
      for (const f of fields) if (f.name === name) f.attempt()
    },
  })
  afterMount(() => {
    const node = form()
    if (!node) return
    const onSubmit = (e: Event) => {
      const submit = e as SubmitEvent
      send({ type: "SUBMIT.ATTEMPT", submitEvent: submit, submitter: submit.submitter })
    }
    // Native validation fires one `invalid` per failing control and no `submit`: the events
    // of one task are one attempt.
    let grouped = false
    const onInvalid = () => {
      if (grouped) return
      grouped = true
      queueMicrotask(() => {
        grouped = false
        send({ type: "SUBMIT.ATTEMPT", submitEvent: null, submitter: null })
      })
    }
    const onReset = (e: Event) =>
      env.scheduler.setTimeout(() => {
        if (!e.defaultPrevented) send({ type: "RESET" })
      }, 0)
    node.addEventListener("submit", onSubmit, true)
    node.addEventListener("invalid", onInvalid, true)
    node.addEventListener("reset", onReset)
    onCleanup(() => {
      node.removeEventListener("submit", onSubmit, true)
      node.removeEventListener("invalid", onInvalid, true)
      node.removeEventListener("reset", onReset)
    })
  })
  const state = reactive<FormState>(() => ({
    invalid: view().context.failed,
    validating: view().state === "validating",
  }))
  const merged = createMemo(() =>
    mergeProps(
      {
        ...normalizeProps(
          formConnect({
            instance: instance(),
            state: view().state,
            failed: view().context.failed,
            validationBehavior: own.validationBehavior ?? "native",
          }),
        ),
        ...(rest.id === undefined ? {} : { id: rest.id }),
        ref: setEl,
      },
      rest,
    ),
  )
  const children = () => resolveChildren(own.children, state)
  return (
    <FormContext.Provider value={binding}>
      {renderPart(own.render, merged, state, children, (p) => (
        <form {...p}>{children()}</form>
      ))}
    </FormContext.Provider>
  )
}

/** The parts, by name: `form.parts.ts` re-exports them as the `Form` namespace. */
export { Root }
