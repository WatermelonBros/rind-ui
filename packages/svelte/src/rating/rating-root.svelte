<script lang="ts">
import {
  type ChangeDetails,
  focusSafely,
  hiddenFormInput,
  type Modality,
  mergeFieldProps,
  normalizeRating,
  partId,
  type RatingEvent,
  ratingConnect,
  ratingFormValue,
  ratingMachine,
  ratingMessages,
  ratingRange,
  resolveRating,
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
import { useModality } from "../use-modality.svelte"
import { ratingContext } from "./context"
import type { RatingRootProps, RatingState } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  count,
  allowHalf,
  allowClear,
  disabled = false,
  readonly: readOnly = false,
  required = false,
  invalid = false,
  name,
  form,
  locale: ownLocale,
  dir: ownDir,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: RatingRootProps = $props()

const env = useEnvironment()
const uid = $props.id()
const instance = $derived(id ?? uid)
const locale = useLocale(
  () => ownLocale,
  () => ownDir,
)
const messages = useMessages("rating", ratingMessages, () => ownMessages)
const binding = useFieldControl(uid)
const fieldsetContext = useFieldsetDisabled()
let fieldsetDom = $state(false)
const registry = usePartRegistry<"label">(untrack(() => ({ scope: "rating", root: instance })))
const ownLabel = useRenderedId(registry, "label")
const range = $derived(ratingRange({ count, allowHalf, allowClear }))
// Normalised once, at creation; later defaults change a reset only.
const creationDefault = untrack(() => normalizeRating(defaultValue, range))
const input: { current: HTMLInputElement | null } = { current: null }
const carrier: { current: HTMLInputElement | null } = { current: null }
const control: { current: Element | null } = { current: null }
const field = $derived(
  mergeFieldProps(
    {
      role: "slider",
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
const rangeInput = hiddenFormInput({ input: () => input.current }, env)
const carrierInput = hiddenFormInput(
  { input: () => carrier.current, control: () => input.current },
  env,
)
const sync = (v: number, dispatch: boolean) => {
  rangeInput.sync({ value: String(v) }, { dispatch: false })
  carrierInput.sync({ value: ratingFormValue(v) }, { dispatch })
}
const focusInput = (modality: Modality) => {
  if (input.current) void focusSafely(input.current, env, "programmatic", modality)
}
let lastReason: string | null = null
const machineProps = () => ({
  value,
  defaultValue: defaultValue ?? creationDefault,
  count,
  allowHalf,
  allowClear,
  disabled: field.disabled,
  readOnly: field.readOnly,
  onValueChange: (next: number, details: ChangeDetails<RatingEvent>) => {
    lastReason = details.reason
    // Uncontrolled: the inputs already show the value when the consumer runs (a
    // requestSubmit() there submits it); a cancel re-syncs them ($reverted).
    if (value === undefined) sync(next, false)
    let cancelled = false
    onValueChange?.(next, {
      ...details,
      cancel: () => {
        cancelled = true
        details.cancel()
      },
    })
    if (!cancelled && value !== undefined) value = next
  },
})
const machine = useMachine(ratingMachine, machineProps, { inputs: { sync }, focusInput })
const current = $derived(resolveRating(machineProps(), machine.view.values.value).value)
const focused = $derived(machine.view.context.focused)
const modality = useModality(env.modality, () => focused)
const api = $derived(
  ratingConnect({
    instance,
    dir: locale.current.dir,
    value: current,
    preview: machine.view.context.preview,
    range,
    field,
    fieldData: binding?.().data,
    focused,
    modality: modality.current,
    ids: {
      root: instance,
      label: partId("rating", instance, "label"),
      input: partId("rating", instance, "input"),
      hiddenInput: partId("rating", instance, "hidden-input"),
    },
    labelledBy: binding?.().ids.label ?? ownLabel.current,
    locale: locale.current.locale,
    messages: messages(),
    form,
    defaultValue: normalizeRating(defaultValue ?? creationDefault, range),
  }),
)
// After every update: the inputs show the value (hydration, a parent's change); no events.
$effect(() => {
  const now = current
  untrack(() => {
    rangeInput.sync({ value: String(now) }, { dispatch: false })
    carrierInput.sync({ value: ratingFormValue(now) }, { dispatch: false })
  })
})
$effect(() =>
  untrack(() => {
    const node = control.current ?? input.current
    const offs: (() => void)[] = []
    if (node) {
      const w = watchFieldset(node)
      if (w) offs.push(w)
    }
    // Reset (through the carrier) and native adoption (assistive technology on the range input).
    offs.push(
      carrierInput.track({
        onReset: () => machine.send({ type: "RESET" }),
        current: () => ({ value: ratingFormValue(current) }),
      }),
      rangeInput.track({
        onReset: () => {},
        resetsWithForm: false,
        current: () => ({ value: String(current) }),
        onNativeInput: (el) => {
          machine.send({ type: "INPUT.CHANGE", value: Number(el.value) })
          return true
        },
      }),
    )
    // field-control: one control; the carrier is its validity element, the range input its focus.
    if (binding) {
      const inputId = partId("rating", instance, "input")
      offs.push(
        binding().register(
          {
            id: inputId,
            labelable: false,
            focus: focusInput,
            validityElement: () => carrier.current,
            value: () => current,
          },
          inputId,
        ),
      )
    }
    return () => {
      for (const off of offs) off()
    }
  }),
)
function watchFieldset(node: Element) {
  const w = watchFieldsetDisabled(node, (d) => (fieldsetDom = d))
  fieldsetDom = w.disabled
  return w.stop
}
let reported = untrack(() => current)
$effect(() => {
  const now = current
  untrack(() => {
    if (reported === now) return
    reported = now
    const user = lastReason !== null && lastReason !== "RESET"
    lastReason = null
    binding?.().report({ type: "change", value: now, user, composing: false })
    if (user) binding?.().report({ type: "commit" })
  })
})
const ratingState: RatingState = $derived({
  value: current,
  preview: machine.view.context.preview,
  count: range.count,
  disabled: field.disabled,
  readOnly: field.readOnly,
})
ratingContext.set({
  instance: () => instance,
  api: () => api,
  state: () => ratingState,
  send: machine.send,
  registry,
  input,
  carrier,
  control,
  inField: binding !== null,
  dir: () => locale.current.dir,
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(api.root()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: ratingState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(ratingState)}</div>
{/if}
