<script lang="ts">
import {
  announcerCapability,
  type ChangeDetails,
  createNumberParser,
  hiddenFormInput,
  type NumberInputEvent,
  type NumberInputReason,
  type NumberInputTrigger,
  numberInputMachine,
  numberInputMessages,
  partId,
} from "@rind-ui/core"
import { useFieldBindingPeek } from "../field/context.svelte"
import FieldHost from "../field/field-host.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { numberInputContext, numberInputNaming } from "./context"
import HiddenInput from "./number-input-hidden-input.svelte"
import type { NumberInputRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue = null,
  onValueChange,
  onValueCommit,
  onInputValueChange,
  min,
  max,
  step,
  largeStep,
  formatOptions,
  locale: ownLocale,
  dir: ownDir,
  commitBehavior,
  allowWheel = false,
  spinOnPress,
  spinDelay,
  spinInterval,
  form,
  messages: ownMessages,
  fieldMessages,
  id,
  children,
  ...fieldProps
}: NumberInputRootProps = $props()

/** Machine reasons → the public ones (spec "Value And Callbacks"). */
function publicReason(type: string): NumberInputReason {
  if (type.startsWith("after:")) return "SPIN"
  switch (type) {
    case "FIRST":
    case "LAST":
      return "EDGE"
    case "WHEEL":
      return "WHEEL"
    case "PASTE":
      return "PASTE"
    case "RESET":
      return "RESET"
    case "COMMIT":
    case "INPUT.ADOPT":
      return "INPUT.COMMIT"
    default:
      return "STEP"
  }
}
const naming = numberInputNaming.maybe() ?? null
const env = useEnvironment(announcerCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const locale = useLocale(
  () => ownLocale,
  () => ownDir,
)
const messages = useMessages("number-input", numberInputMessages, () => ownMessages)
// Cached by value: an inline options object each render keeps the parser (RX#1893).
const parser = $derived(createNumberParser(locale.current.locale, formatOptions))
const enclosing = useFieldBindingPeek()
const fieldsetDisabled = useFieldsetDisabled()
const disabled = $derived(
  fieldProps.disabled === true || enclosing?.().state.disabled === true || fieldsetDisabled(),
)
const readOnly = $derived(fieldProps.readonly === true || enclosing?.().state.readOnly === true)
const inputEl: { current: HTMLInputElement | null } = { current: null }
const hiddenEl: { current: HTMLInputElement | null } = { current: null }
const formInput = hiddenFormInput(
  { input: () => hiddenEl.current, control: () => inputEl.current },
  env,
)
const machine = useMachine(
  numberInputMachine,
  () => ({
    value,
    defaultValue,
    onValueChange: (v: number | null, details: ChangeDetails<NumberInputEvent>) => {
      let cancelled = false
      onValueChange?.(v, {
        reason: publicReason(details.reason),
        modality: (details.event as { modality?: string }).modality,
        cancel: () => {
          cancelled = true
          details.cancel()
        },
      })
      if (!cancelled && value !== undefined) value = v
    },
    onValueCommit: (v: number | null, d: Parameters<NonNullable<typeof onValueCommit>>[1]) =>
      onValueCommit?.(v, d),
    onInputValueChange: (t: string) => onInputValueChange?.(t),
    min,
    max,
    step,
    largeStep,
    commitBehavior,
    spinOnPress,
    spinDelay,
    spinInterval,
    disabled,
    readOnly,
    parser,
    messages: messages(),
    id: instance,
  }),
  // The service is created once: the provider's scheduler and announcer, plus the input.
  { scheduler: env.scheduler, announcer: env.announcer, formInput },
)
let mounted = $state(false)
$effect(() => {
  mounted = true
})
let pressed = $state({ increment: false, decrement: false })
const setPressed = (t: NumberInputTrigger, on: boolean) => {
  if (pressed[t] !== on) pressed = { ...pressed, [t]: on }
}
let inputId = $state<string | null>(null)
const ids = $derived({
  input: inputId ?? partId("number-input", instance, "input"),
  increment: partId("number-input", instance, "increment-trigger"),
  decrement: partId("number-input", instance, "decrement-trigger"),
  hiddenInput: partId("number-input", instance, "hidden-input"),
})
const modality = useModality(env.modality, () => machine.view.context.focused)
numberInputContext.set({
  instance: () => instance,
  view: () => machine.view,
  send: machine.send,
  parser: () => parser,
  messages,
  disabled: () => disabled,
  readOnly: () => readOnly,
  min: () => min,
  max: () => max,
  step: () => step,
  defaultValue: () => defaultValue,
  allowWheel: () => allowWheel,
  form: () => form,
  dir: () => locale.current.dir,
  inputEl,
  hiddenEl,
  formInput,
  mounted: () => mounted,
  pressed: () => pressed,
  setPressed,
  ids: () => ids,
  setInputId: (next) => {
    inputId = next
  },
})
const focused = $derived(machine.view.context.focused)
const rootData = $derived({
  "data-focus": focused ? "" : undefined,
  "data-focus-visible":
    focused && modality.current !== "pointer" && modality.current !== "touch" ? "" : undefined,
  "data-spinning": machine.view.matches("spinning") ? "" : undefined,
  "data-composing": machine.view.matches("composing") ? "" : undefined,
})
</script>

<FieldHost
  {...fieldProps}
  scope={naming?.scope ?? "number-input"}
  {...naming ? { rootPart: naming.part("root") } : {}}
  id={instance}
  dir={locale.current.dir}
  {...fieldMessages ? { messages: fieldMessages } : {}}
  {...rootData}
>{@render children?.()}<HiddenInput /></FieldHost>
