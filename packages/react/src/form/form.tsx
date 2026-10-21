"use client"

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
  quirkActive,
  type ValidationBehavior,
  type ValidationMode,
} from "@rind-ui/core"
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type Ref,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react"
import { composeRefs, mergeProps } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { type RenderProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"

declare module "../provider" {
  interface RindMessageScopes {
    form: FormMessages
  }
}

/** What a Field reads from its Form. A fresh value per Form: never an ancestor's. */
export interface FormBinding {
  readonly validationMode?: ValidationMode | undefined
  readonly validationBehavior?: ValidationBehavior | undefined
  /** The server errors for a name, the same array while `errors` is the same object. */
  errorsFor(name: string | undefined): readonly string[] | undefined
  register(field: FormField): () => void
  /** A Field's async check settled (a held submission may go on). */
  settled(): void
  /** Who asked for the reset in progress: a user, or the framework after an action. */
  resetOrigin(): "user" | "framework"
}

const FormContext = createContext<FormBinding | null>(null)

/** The enclosing Form, or null (a Field works in a plain `<form>` too). */
export function useFormBinding(): FormBinding | null {
  return useContext(FormContext)
}

export interface FormActions {
  /** Validates every Field (or the one named): errors are displayed; nothing is focused. */
  validate(name?: string): void
}

export interface FormState {
  readonly invalid: boolean
  readonly validating: boolean
}

export type FormRootProps = Omit<ComponentPropsWithRef<"form">, "children"> & {
  /** The form's content (its Fields and controls). */
  readonly children?: ReactNode
  /** Default mode for the Fields inside. */
  readonly validationMode?: ValidationMode
  /** Default behaviour for the Fields inside; `aria` adds `novalidate`. */
  readonly validationBehavior?: ValidationBehavior
  /** Server errors by Field name (exact name: `items.0.name` matches as a string). */
  readonly errors?: FormErrors
  /** Replaces the native submission: typed values of every named Field. */
  readonly onFormSubmit?: (
    values: Readonly<Record<string, unknown>>,
    details: FormSubmitDetails,
  ) => void
  readonly messages?: MessageOverrides<FormMessages>
  /** The imperative `validate(name?)`. */
  readonly actionsRef?: Ref<FormActions>
  readonly render?: RenderProp<FormState>
}

function Root({
  validationMode,
  validationBehavior,
  errors,
  onFormSubmit,
  messages: ownMessages,
  actionsRef,
  render,
  id,
  ref,
  children,
  ...rest
}: FormRootProps) {
  const env = useEnvironment(announcerCapability)
  const instance = useRootId(id)
  const messages = useMessages("form", formMessages, ownMessages)
  const fields = useRef(new Set<FormField>())
  const el = useRef<HTMLFormElement | null>(null)
  const { view, send } = useMachine(
    formMachine,
    {
      validationMode,
      validationBehavior,
      errors,
      onFormSubmit,
      messages,
      fields: () => [...fields.current],
      // After the current machine step: the new submit is then handled (and cancelled or
      // replaced by onFormSubmit) while it is being dispatched.
      requestSubmit: (submitter) =>
        queueMicrotask(() => el.current?.requestSubmit(submitter ?? undefined)),
    },
    env,
  )
  // Normalised once per `errors` object, so a re-render never re-applies cleared errors.
  const byName = useMemo(() => {
    const out = new Map<string, readonly string[]>()
    for (const [name, m] of Object.entries(errors ?? {}))
      out.set(name, typeof m === "string" ? [m] : m)
    return out
  }, [errors])
  const origin = useRef<"user" | "framework">("user")
  const binding: FormBinding = useMemo(
    () => ({
      validationMode,
      validationBehavior,
      errorsFor: (name) => (name === undefined ? undefined : byName.get(name)),
      register(field) {
        fields.current.add(field)
        return () => fields.current.delete(field)
      },
      settled: () => send({ type: "FIELD.SETTLED" }),
      resetOrigin: () => origin.current,
    }),
    [validationMode, validationBehavior, byName, send],
  )
  useImperativeHandle(
    actionsRef,
    () => ({
      validate(name) {
        if (name === undefined) return send({ type: "VALIDATE" })
        for (const f of fields.current) if (f.name === name) f.attempt()
      },
    }),
    [send],
  )
  useEffect(() => {
    const form = el.current
    if (!form) return
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
    const onReset = (e: Event) => {
      env.scheduler.setTimeout(() => {
        if (!e.defaultPrevented) send({ type: "RESET" })
        origin.current = "user"
      }, 0)
    }
    form.addEventListener("submit", onSubmit, true)
    form.addEventListener("invalid", onInvalid, true)
    form.addEventListener("reset", onReset)
    // React 19 resets a form after its action with no user event in progress: that reset
    // keeps the server errors the action delivered (quirk react-action-form-reset).
    const own = Object.getOwnPropertyDescriptor(form, "reset")
    if (quirkActive("react-action-form-reset", env)) {
      const reset = HTMLFormElement.prototype.reset
      form.reset = function (this: HTMLFormElement) {
        const current = Reflect.get(globalThis, "event") as Event | undefined
        origin.current = current === undefined || current.type === "message" ? "framework" : "user"
        reset.call(this)
      }
    }
    return () => {
      form.removeEventListener("submit", onSubmit, true)
      form.removeEventListener("invalid", onInvalid, true)
      form.removeEventListener("reset", onReset)
      if (own) Object.defineProperty(form, "reset", own)
      else Reflect.deleteProperty(form, "reset")
    }
  }, [send, env])
  const own = normalizeProps(
    formConnect({
      instance,
      state: view.state,
      failed: view.context.failed,
      validationBehavior: validationBehavior ?? "native",
    }),
  )
  const props = mergeProps(
    { ...own, ...(id === undefined ? {} : { id }), ref: composeRefs(el, ref) },
    rest,
  )
  return (
    <FormContext value={binding}>
      {renderPart("form", { ...props, children }, render, {
        invalid: view.context.failed,
        validating: view.state === "validating",
      })}
    </FormContext>
  )
}

/** Closes the context: a Form inside a Form (through a portal) starts fresh. */
export const Form = { Root }
