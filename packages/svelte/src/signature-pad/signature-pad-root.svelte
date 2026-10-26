<script lang="ts">
import {
  announcerCapability,
  EMPTY_SIGNATURE,
  exportSignature,
  focusSafely,
  hiddenFormInput,
  mergeFieldProps,
  partId,
  type SignatureExportOptions,
  type SignatureValue,
  sanitizeFileName,
  saveBlob,
  signatureFormValue,
  signaturePadConnect,
  signaturePadMachine,
  signaturePadMessages,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useFieldControl } from "../field/context.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { signaturePadContext } from "./context"
import type { SignaturePadRenderState, SignaturePadRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  name,
  form,
  formValue = "svg",
  inkColor = "#000",
  required = false,
  disabled = false,
  readonly: readOnly = false,
  invalid = false,
  minDistance,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: SignaturePadRootProps = $props()

const env = useEnvironment(announcerCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const locale = useLocale(() => ownLocale)
const messages = useMessages("signature-pad", signaturePadMessages, () => ownMessages)
const binding = useFieldControl(uid)
const fieldsetContext = useFieldsetDisabled()
let fieldsetDom = $state(false)
const registry = usePartRegistry<"label" | "status">(
  untrack(() => ({ scope: "signature-pad", root: instance })),
)
const ownLabel = useRenderedId(registry, "label")
const status = useRenderedId(registry, "status")
const field = $derived(
  mergeFieldProps(
    {
      role: "img",
      labelable: false,
      disabled: disabled || fieldsetContext() || fieldsetDom,
      readOnly,
      required,
      invalid,
      name,
    },
    binding?.() ?? null,
  ),
)
const ids = $derived({
  label: partId("signature-pad", instance, "label"),
  control: partId("signature-pad", instance, "control"),
  status: partId("signature-pad", instance, "status"),
  input: partId("signature-pad", instance, "hidden-input"),
})
const input: { current: HTMLInputElement | null } = { current: null }
const control: { current: HTMLElement | null } = { current: null }
const formInput = hiddenFormInput(
  { input: () => input.current, control: () => control.current },
  env,
)
const encode = (v: SignatureValue) => signatureFormValue(v, formValue, inkColor)
let lastUser = false
const machineProps = () => ({
  value,
  defaultValue,
  onValueChange: (next: SignatureValue) => {
    lastUser = true
    onValueChange?.(next)
    if (value !== undefined) value = next
  },
  disabled: field.disabled,
  readOnly: field.readOnly,
  minDistance,
  messages: messages(),
  id: instance,
  lang: locale.current.locale,
})
const machine = useMachine(signaturePadMachine, machineProps, {
  ...env,
  syncInput: (v: SignatureValue, dispatch: boolean) =>
    formInput.sync({ value: encode(v) }, { dispatch }),
})
const current = $derived(machine.view.values.value ?? EMPTY_SIGNATURE)
const labelId = $derived(binding?.().ids.label ?? ownLabel.current)
const api = $derived(
  signaturePadConnect(
    {
      instance,
      state: machine.view.state,
      value: current,
      stroke: machine.view.context.stroke,
      messages: messages(),
      ids: { ...ids, label: labelId ?? ids.label },
      rendered: { label: labelId !== undefined, status: status.current !== undefined },
      disabled: field.disabled,
      readOnly: field.readOnly,
      required: field.required,
      invalid: field.invalid,
      name: field.name,
      form,
      formValue,
      inkColor,
      describedBy: field["aria-describedby"],
    },
    env,
  ),
)
// After every update: the input shows the value (hydration, a parent's change); no events.
$effect(() => {
  const now = encode(current)
  untrack(() => formInput.sync({ value: now }, { dispatch: false }))
})
$effect(() =>
  untrack(() => {
    const offs: (() => void)[] = []
    if (input.current) {
      const w = watchFieldsetDisabled(input.current, (d) => (fieldsetDom = d))
      fieldsetDom = w.disabled
      offs.push(w.stop)
    }
    offs.push(
      formInput.track({
        onReset: () => machine.send({ type: "RESET" }),
        current: () => ({ value: encode(current) }),
      }),
    )
    // field-control: the Control takes focus; the hidden input is the validity element.
    if (binding) {
      offs.push(
        binding().register(
          {
            id: ids.control,
            labelable: false,
            focus: (m) => {
              if (control.current) void focusSafely(control.current, env, "programmatic", m)
            },
            validityElement: () => input.current,
            value: () => current,
          },
          ids.control,
        ),
      )
    }
    return () => {
      for (const off of offs) off()
    }
  }),
)
let reported = untrack(() => current)
$effect(() => {
  const now = current
  untrack(() => {
    if (reported === now) return
    reported = now
    const user = lastUser
    lastUser = false
    binding?.().report({ type: "change", value: now, user, composing: false })
    if (user) binding?.().report({ type: "commit" })
  })
})
const toBlob = (options: SignatureExportOptions = {}) => {
  const el = control.current
  const color = el ? getComputedStyle(el).color : inkColor
  return exportSignature(current, {
    ...options,
    color,
    ...(el ? { doc: el.ownerDocument } : {}),
  })
}
const download = async (fileName = "signature.png", options: SignatureExportOptions = {}) => {
  const blob = await toBlob(options)
  saveBlob(
    control.current?.ownerDocument ?? document,
    blob,
    sanitizeFileName(fileName, "signature.png"),
  )
}
const padState: SignaturePadRenderState = $derived({
  state: machine.view.state,
  value: current,
  empty: api.empty,
  strokeCount: api.strokeCount,
  disabled: field.disabled,
  readOnly: field.readOnly,
  toBlob,
  download,
})
signaturePadContext.set({
  api: () => api,
  send: machine.send,
  state: () => padState,
  registry,
  ids: () => ({ label: ids.label, status: ids.status }),
  control,
})
const merged = $derived(
  stripMarker(
    mergeProps(
      { ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) },
      { ...binding?.().data, ...rest },
    ),
  ),
)
const captureInput = (node: HTMLInputElement) => {
  input.current = node
  return () => {
    if (input.current === node) input.current = null
  }
}
</script>

{#snippet hidden()}<input {...attrs(normalizeProps(api.hiddenInput()))} {@attach captureInput} />{/snippet}

{#if child}
  {@render child({ props: merged, state: padState })}{@render hidden()}
{:else}
  <div {...attrs(merged)}>{@render children?.(padState)}{@render hidden()}</div>
{/if}
