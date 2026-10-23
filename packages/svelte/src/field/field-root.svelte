<script lang="ts">
import {
  announcerCapability,
  type FieldControlBinding,
  type FieldControlReport,
  type FieldPart,
  fieldConnect,
  fieldDisplay,
  fieldMachine,
  fieldMessages,
  formValues,
  getLayerStack,
  partId,
  type RegisteredControl,
  registerFormValue,
  validityCapability,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { elementRef } from "../element-ref.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { useFormBinding } from "../form/context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { fieldControl, fieldParts } from "./context.svelte"
import type { FieldRootProps } from "./types"

const {
  name,
  disabled: ownDisabled = false,
  readonly: readOnly = false,
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
  scope,
  rootPart,
  id,
  child,
  children,
  ...rest
}: FieldRootProps = $props()

const env = useEnvironment(announcerCapability, validityCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const messages = useMessages("field", fieldMessages, () => ownMessages)
const fieldsetDisabled = useFieldsetDisabled()
const disabled = $derived(ownDisabled || fieldsetDisabled())
let labelEl: Element | null = null
let registered = $state.raw<{ control: RegisteredControl; label: string } | null>(null)
/** The dirty baseline: the value at the first registration, once per Field. */
let baseline = $state.raw<{ value: unknown } | null>(null)
/** The control that claimed the binding first; any other gets none (zag#2475). */
let owner: string | null = null
// Inside a Form: its defaults, its server errors by name, and it leads an attempt.
const form = useFormBinding()
const validationMode = $derived(ownMode ?? form?.validationMode ?? "submit")
const validationBehavior = $derived(ownBehavior ?? form?.validationBehavior ?? "native")
const machine = useMachine(
  fieldMachine,
  () => ({
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
    messages: messages(),
    label: () => (labelEl?.textContent ?? "").trim(),
    formValues: () => formValues(registered?.control.validityElement()?.form),
    control: () => registered?.control ?? null,
  }),
  env,
)
const send = machine.send
// Read once: the registry belongs to the instance.
const registry = usePartRegistry<FieldPart>(untrack(() => ({ scope: "field", root: instance })))
const labelId = useRenderedId(registry, "label")
const descriptionId = useRenderedId(registry, "description")
const errorId = useRenderedId(registry, "error-message")
// The modality tracker must see the pointerdown that comes before focus.
$effect(() => env.modality.subscribe(() => {}))
const modality = useModality(env.modality, () => machine.view.context.focused)
const api = $derived(
  fieldConnect({
    instance,
    state: machine.view.state,
    context: machine.view.context,
    props: { disabled, readOnly, required, invalid },
    touched,
    dirty,
    modality: modality.current,
    control: registered
      ? { id: registered.control.id, labelable: registered.control.labelable }
      : null,
    initial: baseline,
    name,
    scope,
    ...(rootPart === undefined ? {} : { rootPart }),
  }),
)
const hasErrorPart = { current: 0 }
const register = (control: RegisteredControl, label: string) => {
  registered = { control, label }
  baseline ??= { value: control.value() }
  send({ type: "CONTROL.REGISTER", control })
  return () => {
    if (registered?.control.id !== control.id) return
    registered = null
    send({ type: "CONTROL.UNREGISTER", id: control.id })
  }
}
const claim = (token: string) => {
  if (owner === null || owner === token) {
    owner = token
    return true
  }
  if (DEV) {
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
const binding: FieldControlBinding = $derived({
  ids: { label: labelId.current, description: descriptionId.current, error: errorId.current },
  data: api.controlData(),
  state: {
    disabled,
    readOnly,
    required,
    invalid: api.display === "invalid",
    validationBehavior,
  },
  name,
  controlId: partId("field", instance, "control"),
  errorMessageAttribute,
  register,
  report,
  claim,
  release,
})
const root = elementRef("div")
// Focus entering and leaving the Field (layers opened from the control count as inside).
$effect(() => {
  const el = root.current
  if (!el) return
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
})
// The validity element can change when the control re-registers.
$effect(() => {
  const input = registered?.control.validityElement()
  const formName = name
  if (!input) return
  return untrack(() => {
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
    // A submission the browser lets through is still an attempt; inside a Form the Form
    // leads the attempt (one per form, one focus, one summary).
    const onSubmit = () => {
      if (!form) send({ type: "SUBMIT.ATTEMPT" })
    }
    input.addEventListener("invalid", onInvalid)
    owningForm?.addEventListener("reset", onReset)
    owningForm?.addEventListener("submit", onSubmit, true)
    const unregister =
      owningForm && formName
        ? registerFormValue(owningForm, formName, () => registered?.control.value())
        : undefined
    return () => {
      input.removeEventListener("invalid", onInvalid)
      owningForm?.removeEventListener("reset", onReset)
      owningForm?.removeEventListener("submit", onSubmit, true)
      unregister?.()
    }
  })
})
// Registered with the Form: it reads the display synchronously (right after an attempt).
$effect(() => {
  if (!form) return
  return untrack(() =>
    form.register({
      id: instance,
      name,
      element: () => root.current,
      attempt: () => send({ type: "SUBMIT.ATTEMPT" }),
      status: () => {
        const snap = machine.service.getSnapshot()
        return snap.state === "validating"
          ? "validating"
          : fieldDisplay(snap.state, snap.context, { disabled, invalid })
      },
      focus: () => registered?.control.focus("keyboard"),
      value: () => registered?.control.value(),
    }),
  )
})
// A held submission goes on once this Field's async check settled.
let wasValidating = false
$effect(() => {
  const validating = machine.view.state === "validating"
  untrack(() => {
    if (wasValidating && !validating) form?.settled()
    wasValidating = validating
  })
})
fieldControl.set(() => binding)
fieldParts.set({
  instance: () => instance,
  registry,
  api: () => api,
  setLabel: (el) => {
    labelEl = el
  },
  control: () => registered?.control ?? null,
  hasErrorPart,
})
const merged = $derived(
  stripMarker(
    mergeProps(
      { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }), ...root.props },
      rest,
    ),
  ),
)
const current = $derived({
  valid: api.display === "valid",
  invalid: api.display === "invalid",
  validating: machine.view.state === "validating",
})
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
