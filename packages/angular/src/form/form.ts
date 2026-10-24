import {
  afterNextRender,
  computed,
  DestroyRef,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  input,
  PLATFORM_ID,
  type Signal,
} from "@angular/core"
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
import type { FormBinding } from "@rind-ui/core/internal"
import { bindProps } from "../bind-props"
import { injectRootId } from "../ids"
import { injectMachine } from "../inject-machine"
import { injectEnvironment, injectMessages } from "../provider"
import { FORM } from "./context"

export interface FormState {
  readonly invalid: boolean
  readonly validating: boolean
}

/** Replaces the native submission: typed values of every named Field. */
export type FormSubmitHandler = (
  values: Readonly<Record<string, unknown>>,
  details: FormSubmitDetails,
) => void

/**
 * A form whose Fields validate together: `<form rindFormRoot aria-label="Sign up">`. A failed
 * submit focuses the first invalid Field and announces the errors.
 */
@Directive({
  selector: "[rindFormRoot]",
  exportAs: "rindFormRoot",
  providers: [{ provide: FORM, useFactory: () => inject(forwardRef(() => FormRoot)).binding }],
})
export class FormRoot {
  /** Default mode for the Fields inside. */
  readonly validationMode = input<ValidationMode>()
  /** Default behaviour for the Fields inside; `aria` adds `novalidate`. */
  readonly validationBehavior = input<ValidationBehavior>()
  /** Server errors by Field name (exact name: `items.0.name` matches as a string). */
  readonly errors = input<FormErrors>()
  /** Replaces the native submission: typed values of every named Field. */
  readonly onFormSubmit = input<FormSubmitHandler>()
  readonly messages = input<MessageOverrides<FormMessages>>()
  readonly id = input<string>()

  /** @internal */
  readonly binding: FormBinding
  /** The form's state, for the template (`#f="rindFormRoot"`, `f.state()`). */
  readonly state: Signal<FormState>
  private readonly fields = new Set<FormField>()
  private readonly send: (event: { type: "VALIDATE" }) => void

  constructor() {
    const env = injectEnvironment(announcerCapability)
    const instance = injectRootId(() => this.id())
    const messages = injectMessages("form", formMessages, () => this.messages())
    const el: Element = inject(ElementRef).nativeElement
    const form = () => (el instanceof HTMLFormElement ? el : null)
    const fields = this.fields
    const { view, send } = injectMachine(
      formMachine,
      () => ({
        validationMode: this.validationMode(),
        validationBehavior: this.validationBehavior(),
        errors: this.errors(),
        onFormSubmit: this.onFormSubmit(),
        messages: messages(),
        fields: () => [...fields],
        // After the current machine step: the new submit is then handled (and cancelled or
        // replaced by onFormSubmit) while it is being dispatched.
        requestSubmit: (submitter: HTMLElement | null | undefined) =>
          queueMicrotask(() => form()?.requestSubmit(submitter ?? undefined)),
      }),
      env,
    )
    this.send = send
    // Normalised once per `errors` object, so a render never re-applies cleared errors.
    const byName = computed(() => {
      const out = new Map<string, readonly string[]>()
      for (const [name, m] of Object.entries(this.errors() ?? {}))
        out.set(name, typeof m === "string" ? [m] : m)
      return out
    })
    const self = this
    // Getters: the Fields read the Form's current inputs.
    this.binding = {
      get validationMode() {
        return self.validationMode()
      },
      get validationBehavior() {
        return self.validationBehavior()
      },
      errorsFor: (name) => (name === undefined ? undefined : byName().get(name)),
      register(field) {
        fields.add(field)
        return () => fields.delete(field)
      },
      settled: () => send({ type: "FIELD.SETTLED" }),
      // Angular's forms never reset the DOM form: every reset is the user's.
      resetOrigin: () => "user",
    }
    this.state = computed(() => ({
      invalid: view().context.failed,
      validating: view().state === "validating",
    }))
    bindProps(
      () => ({
        ...formConnect({
          instance: instance(),
          state: view().state,
          failed: view().context.failed,
          validationBehavior: this.validationBehavior() ?? "native",
        }),
        ...(this.id() === undefined ? {} : { id: this.id() }),
      }),
      {
        owns: ["errors", "id", "messages", "onformsubmit", "validationbehavior", "validationmode"],
      },
    )
    if (inject(PLATFORM_ID) !== "browser") return
    const destroy = inject(DestroyRef)
    afterNextRender(() => {
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
      destroy.onDestroy(() => {
        node.removeEventListener("submit", onSubmit, true)
        node.removeEventListener("invalid", onInvalid, true)
        node.removeEventListener("reset", onReset)
      })
    })
  }

  /** Validates every Field (or the one named): errors are displayed; nothing is focused. */
  validate(name?: string): void {
    if (name === undefined) this.send({ type: "VALIDATE" })
    else for (const f of this.fields) if (f.name === name) f.attempt()
  }
}

/** The Form's parts, for a standalone component's `imports`. */
export const Form = [FormRoot] as const
