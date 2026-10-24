<script lang="ts">
import {
  announcerCapability,
  type FormField,
  formConnect,
  formMachine,
  formMessages,
} from "@rind-ui/core"
import { type FormBinding, stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { elementRef } from "../element-ref.svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { formContext } from "./context"
import type { FormRootProps, FormState } from "./types"

const {
  validationMode,
  validationBehavior,
  errors,
  onFormSubmit,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: FormRootProps = $props()

const env = useEnvironment(announcerCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const messages = useMessages("form", formMessages, () => ownMessages)
const fields = new Set<FormField>()
const el = elementRef("form")
const form = () => (el.current instanceof HTMLFormElement ? el.current : null)
const machine = useMachine(
  formMachine,
  () => ({
    validationMode,
    validationBehavior,
    errors,
    onFormSubmit,
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
const byName = $derived.by(() => {
  const out = new Map<string, readonly string[]>()
  for (const [name, m] of Object.entries(errors ?? {}))
    out.set(name, typeof m === "string" ? [m] : m)
  return out
})
// Getters: the Fields read the Form's current props.
const binding: FormBinding = {
  get validationMode() {
    return validationMode
  },
  get validationBehavior() {
    return validationBehavior
  },
  errorsFor: (name) => (name === undefined ? undefined : byName.get(name)),
  register(field) {
    fields.add(field)
    return () => fields.delete(field)
  },
  settled: () => machine.send({ type: "FIELD.SETTLED" }),
  // Svelte has no framework-driven form reset: every reset is the user's.
  resetOrigin: () => "user",
}
formContext.set(binding)
/** Validates every Field (or the one named): errors are displayed; nothing is focused. */
export function validate(name?: string) {
  if (name === undefined) return machine.send({ type: "VALIDATE" })
  for (const f of fields) if (f.name === name) f.attempt()
}
$effect(() => {
  const node = form()
  if (!node) return
  return untrack(() => {
    const onSubmit = (e: Event) => {
      const submit = e as SubmitEvent
      machine.send({ type: "SUBMIT.ATTEMPT", submitEvent: submit, submitter: submit.submitter })
    }
    // Native validation fires one `invalid` per failing control and no `submit`: the events
    // of one task are one attempt.
    let grouped = false
    const onInvalid = () => {
      if (grouped) return
      grouped = true
      queueMicrotask(() => {
        grouped = false
        machine.send({ type: "SUBMIT.ATTEMPT", submitEvent: null, submitter: null })
      })
    }
    const onReset = (e: Event) =>
      env.scheduler.setTimeout(() => {
        if (!e.defaultPrevented) machine.send({ type: "RESET" })
      }, 0)
    node.addEventListener("submit", onSubmit, true)
    node.addEventListener("invalid", onInvalid, true)
    node.addEventListener("reset", onReset)
    return () => {
      node.removeEventListener("submit", onSubmit, true)
      node.removeEventListener("invalid", onInvalid, true)
      node.removeEventListener("reset", onReset)
    }
  })
})
const merged = $derived(
  stripMarker(
    mergeProps(
      {
        ...normalizeProps(
          formConnect({
            instance,
            state: machine.view.state,
            failed: machine.view.context.failed,
            validationBehavior: validationBehavior ?? "native",
          }),
        ),
        ...(id === undefined ? {} : { id }),
        ...el.props,
      },
      rest,
    ),
  ),
)
const current: FormState = $derived({
  invalid: machine.view.context.failed,
  validating: machine.view.state === "validating",
})
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <form {...attrs(merged)}>{@render children?.(current)}</form>
{/if}
