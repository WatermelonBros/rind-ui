<script lang="ts">
import {
  type PinInputEvent,
  type PinInputReason,
  pinInputMachine,
  pinInputMessages,
  renderedValue,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { useFieldBindingPeek } from "../field/context.svelte"
import FieldHost from "../field/field-host.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { pinInputContext, type Rules, useApi } from "./context.svelte"
import type { PinInputRootProps } from "./types"

let {
  length,
  value = $bindable(),
  defaultValue = "",
  onValueChange,
  onValueInvalid,
  onValueComplete,
  validationType,
  pattern,
  sanitize,
  mask = false,
  maskChar = "•",
  autocomplete = "one-time-code",
  autoSubmit = false,
  enterkeyhint,
  form,
  dir,
  messages: ownMessages,
  fieldMessages,
  id,
  children,
  ...fieldProps
}: PinInputRootProps = $props()

/** Machine events → the public reasons. */
function publicReason(event: PinInputEvent): PinInputReason {
  if (event.type === "EDIT") return event.edit.reason
  if (event.type === "INPUT") return event.reason
  if (event.type === "RESET") return "RESET"
  return "INPUT"
}
const uid = $props.id()
const instance = $derived(id ?? uid)
const messages = useMessages("pin-input", pinInputMessages, () => ownMessages)
const enclosing = useFieldBindingPeek()
const fieldsetDisabled = useFieldsetDisabled()
const disabled = $derived(
  fieldProps.disabled === true || enclosing?.().state.disabled === true || fieldsetDisabled(),
)
const readOnly = $derived(fieldProps.readonly === true || enclosing?.().state.readOnly === true)
const rules: Rules = $derived({ length, validationType, pattern, sanitize })
// A `value` that is not undefined (null included: an empty code, ark#3573) is controlled.
// ponytail: Svelte cannot tell an absent prop from an undefined one; React's `value={undefined}`
// controlled-empty case needs `value={null}` here.
const controlled = $derived(value !== undefined)
const shown = $derived(controlled ? renderedValue(rules, value) : undefined)
const inputEl: { current: HTMLInputElement | null } = { current: null }
const pendingCaret = { current: null as number | null }
const pendingSubmit = { current: false }
const userChange = { current: false }
const slots = { current: 0 }
const machine = useMachine(pinInputMachine, () => ({
  ...rules,
  value: shown,
  defaultValue: renderedValue(rules, defaultValue),
  onValueChange: (v: string, details: unknown) => {
    const event = (details as { event: PinInputEvent }).event
    userChange.current = event.type !== "RESET"
    onValueChange?.(v, { reason: publicReason(event) })
    if (controlled) value = v
  },
  onValueInvalid: (t: string) => onValueInvalid?.(t),
  onValueComplete: (v: string) => onValueComplete?.(v),
  autoSubmit,
  disabled,
  readOnly,
  messages: messages(),
  id: instance,
  writeCaret: (index: number) => {
    pendingCaret.current = index
  },
  resync: () => {
    // The value Svelte renders is already right; the DOM may hold the browser's write.
    const el = inputEl.current
    const current = machine.view.values.value
    if (el && el.value !== current) el.value = current
  },
  // After the completed value is rendered (the form must validate the full code).
  requestSubmit: () => {
    pendingSubmit.current = true
  },
}))
$effect(() => {
  const n = length
  if (!DEV) return
  untrack(() => {
    if (!Number.isInteger(n) || n < 1)
      console.warn(`[rind-ui] pin-input: length must be a positive integer (got ${n}).`)
    // Every rendered slot counts; the number must match `length`.
    if (slots.current !== n)
      console.warn(`[rind-ui] pin-input: length is ${n} but ${slots.current} Slots are rendered.`)
  })
})
$effect(() => {
  const v = value
  const rendered = shown
  if (!DEV || !controlled || typeof v !== "string" || v === rendered) return
  untrack(() =>
    console.warn(
      `[rind-ui] pin-input: the controlled value "${v}" is rendered as "${rendered}" (length ${length}, rejected characters dropped).`,
    ),
  )
})
const ctx = {
  instance: () => instance,
  view: () => machine.view,
  send: machine.send,
  length: () => length,
  rules: () => rules,
  mask: () => mask,
  maskChar: () => maskChar,
  autoComplete: () => autocomplete,
  enterKeyHint: () => enterkeyhint,
  form: () => form,
  dir: () => dir,
  disabled: () => disabled,
  readOnly: () => readOnly,
  inputEl,
  pendingCaret,
  pendingSubmit,
  userChange,
  slots,
}
pinInputContext.set(ctx)
const apiFor = useApi(ctx, enclosing)
const root = $derived(apiFor().root())
// The root's state attributes (connect's `data-*`), on the Field host.
const rootData = $derived(
  Object.fromEntries(
    Object.entries(root).filter(
      ([k]) =>
        k.startsWith("data-") && k !== "data-scope" && k !== "data-part" && k !== "data-instance",
    ),
  ) as Record<`data-${string}`, string | undefined>,
)
const hostDir = $derived((root["dir"] as "ltr" | "rtl" | undefined) ?? "ltr")
</script>

<FieldHost
  scope="pin-input"
  id={instance}
  dir={hostDir}
  {...fieldProps}
  {...fieldMessages ? { messages: fieldMessages } : {}}
  {...rootData}
>{@render children?.()}</FieldHost>
