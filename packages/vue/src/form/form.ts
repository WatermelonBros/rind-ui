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
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  type PropType,
  provide,
  type SlotsType,
  shallowRef,
  type VNodeChild,
} from "vue"
import { mergeProps, refTo } from "../merge-props"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { asChildProp, renderPart } from "../render"
import { useRootId } from "../use-ids"
import { useMachine } from "../use-machine"
import { FormKey } from "./context"

declare module "../provider" {
  interface RindMessageScopes {
    form: FormMessages
  }
}

/** What the Root exposes (a template ref on it). */
export interface FormActions {
  /** Validates every Field (or the one named): errors are displayed; nothing is focused. */
  validate(name?: string): void
}

export interface FormState {
  readonly invalid: boolean
  readonly validating: boolean
}

const Root = defineComponent({
  name: "FormRoot",
  inheritAttrs: false,
  props: {
    /** Default mode for the Fields inside. */
    validationMode: String as PropType<ValidationMode>,
    /** Default behaviour for the Fields inside; `aria` adds `novalidate`. */
    validationBehavior: String as PropType<ValidationBehavior>,
    /** Server errors by Field name (exact name: `items.0.name` matches as a string). */
    errors: Object as PropType<FormErrors>,
    /** Replaces the native submission: typed values of every named Field. */
    onFormSubmit: Function as PropType<
      (values: Readonly<Record<string, unknown>>, details: FormSubmitDetails) => void
    >,
    messages: Object as PropType<MessageOverrides<FormMessages>>,
    id: String,
    ...asChildProp,
  },
  slots: Object as SlotsType<{ default?: (state: FormState) => VNodeChild }>,
  setup(props, { attrs, slots, expose }) {
    const env = useEnvironment(announcerCapability)
    const instance = useRootId(() => props.id)
    const messages = useMessages("form", formMessages, () => props.messages)
    const fields = new Set<FormField>()
    const el = shallowRef<Element | null>(null)
    const form = () => (el.value instanceof HTMLFormElement ? el.value : null)
    const { view, send } = useMachine(
      formMachine,
      () => ({
        validationMode: props.validationMode,
        validationBehavior: props.validationBehavior,
        errors: props.errors,
        onFormSubmit: props.onFormSubmit,
        messages: messages.value,
        fields: () => [...fields],
        // After the current machine step: the new submit is then handled (and cancelled or
        // replaced by onFormSubmit) while it is being dispatched.
        requestSubmit: (submitter: HTMLElement | null | undefined) =>
          queueMicrotask(() => form()?.requestSubmit(submitter ?? undefined)),
      }),
      env,
    )
    // Normalised once per `errors` object, so an update never re-applies cleared errors.
    const byName = computed(() => {
      const out = new Map<string, readonly string[]>()
      for (const [name, m] of Object.entries(props.errors ?? {}))
        out.set(name, typeof m === "string" ? [m] : m)
      return out
    })
    // Getters: the Fields read the Form's current props.
    const binding: FormBinding = {
      get validationMode() {
        return props.validationMode
      },
      get validationBehavior() {
        return props.validationBehavior
      },
      errorsFor: (name) => (name === undefined ? undefined : byName.value.get(name)),
      register(field) {
        fields.add(field)
        return () => fields.delete(field)
      },
      settled: () => send({ type: "FIELD.SETTLED" }),
      // Vue has no framework-driven form reset: every reset is the user's.
      resetOrigin: () => "user",
    }
    provide(FormKey, binding)
    expose({
      validate(name?: string) {
        if (name === undefined) return send({ type: "VALIDATE" })
        for (const f of fields) if (f.name === name) f.attempt()
      },
    } satisfies FormActions)
    onMounted(() => {
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
      onBeforeUnmount(() => {
        node.removeEventListener("submit", onSubmit, true)
        node.removeEventListener("invalid", onInvalid, true)
        node.removeEventListener("reset", onReset)
      })
    })
    return () => {
      const own = normalizeProps(
        formConnect({
          instance: instance(),
          state: view.value.state,
          failed: view.value.context.failed,
          validationBehavior: props.validationBehavior ?? "native",
        }),
      )
      return renderPart(
        "form",
        mergeProps(
          { ...own, ...(props.id === undefined ? {} : { id: props.id }), ref: refTo(el) },
          attrs,
        ),
        slots.default?.({
          invalid: view.value.context.failed,
          validating: view.value.state === "validating",
        }),
        props.asChild,
      )
    }
  },
})

/** The parts, by name: `form.parts.ts` re-exports them as the `Form` namespace. */
export { Root }
