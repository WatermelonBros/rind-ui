<script lang="ts">
// Color Field parts (design §6): wiring only. The Color Field's machine owns the draft and the
// commit points; the text filter runs on the resulting text in `beforeinput` and again in
// `input` (react-spectrum#3985).
import { type Color, hiddenFormInput, mergeFieldProps, partId } from "@rind-ui/core"
import {
  COLOR_PICKER_SCOPE,
  colorFieldConnect,
  colorFieldFormValue,
  colorFieldMachine,
  colorFieldMessages,
  colorFieldPart,
  colorFieldValue,
} from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useColorProp } from "../color-input"
import { useFieldBindingPeek } from "../field/context.svelte"
import FieldHost from "../field/field-host.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import HiddenInput from "./color-field-hidden-input.svelte"
import { colorField, colorFlush } from "./context"
import type { ColorFieldReason, ColorFieldRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue: defaultProp,
  onValueChange,
  onInputValueChange,
  format = "hex",
  alpha = false,
  colorSpace,
  form,
  locale: ownLocale,
  dir: ownDir,
  messages: ownMessages,
  fieldMessages,
  children,
  id,
  ...fieldProps
}: ColorFieldRootProps = $props()

const reasonOf = (r: string): ColorFieldReason =>
  r === "RESET" ? "RESET" : r === "ADOPT" ? "ADOPT" : "INPUT.COMMIT"
const env = useEnvironment()
const uid = $props.id()
const instance = untrack(() => id ?? uid)
const loc = useLocale(
  () => ownLocale,
  () => ownDir,
)
const messages = useMessages("color-field", colorFieldMessages, () => ownMessages)
const parsedValue = useColorProp(() => value ?? undefined, "value", "color-field")
const parsedDefault = useColorProp(() => defaultProp ?? undefined, "defaultValue", "color-field")
const current = $derived(value === null ? null : parsedValue())
const defaultValue = $derived(defaultProp === null ? null : (parsedDefault() ?? null))
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
const controlled = untrack(() => value !== undefined)
const machine = useMachine(
  colorFieldMachine,
  () => ({
    value: current,
    defaultValue,
    format,
    alpha,
    colorSpace,
    disabled,
    readOnly,
    onValueChange: (c: Color | null, d: { reason: string; cancel(): void }) => {
      // Uncontrolled: the form value is current before an implicit submission reads it.
      if (!controlled) formInput.sync({ value: colorFieldFormValue(c) }, { dispatch: false })
      let refused = false
      onValueChange?.(c, {
        reason: reasonOf(d.reason),
        space: c?.space ?? colorSpace ?? "rgb",
        cancel: () => {
          refused = true
          d.cancel()
        },
      })
      if (!refused && controlled) value = c
    },
    onInputValueChange: (t: string) => onInputValueChange?.(t),
  }),
  {},
)
const view = $derived(machine.view)
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
// The modality tracker must see the key or pointer that comes before the input's focus.
$effect(() => env.modality.subscribe(() => {}))
const field = $derived(
  mergeFieldProps(
    {
      role: "textbox",
      labelable: true,
      disabled,
      readOnly,
      required: fieldProps.required === true,
      invalid: fieldProps.invalid === true,
      ...(fieldProps.name === undefined ? {} : { name: fieldProps.name }),
    },
    enclosing?.() ?? null,
  ),
)
const shown = $derived(
  colorFieldValue({ value: current, defaultValue, format, alpha }, view.values.value),
)
const dirty = $derived(view.state !== "idle")
const api = $derived(
  colorFieldConnect({
    instance,
    value: shown,
    draft: dirty ? view.context.draft : null,
    invalidDraft: view.state === "invalid",
    format,
    alpha,
    field,
    focused,
    modality: modality.current,
    ids: {
      input: partId("color-field", instance, "input"),
      hiddenInput: partId("color-field", instance, "hidden-input"),
    },
    form,
    defaultValue,
  }),
)
// An owner's flush (a picker closing) commits a valid draft first.
const registry = colorFlush.maybe() ?? null
$effect(() =>
  registry ? untrack(() => registry.register(() => machine.send({ type: "FLUSH" }))) : undefined,
)
colorField.set({
  api: () => api,
  state: () => ({
    value: shown,
    text: api.text,
    dirty,
    invalid: view.state === "invalid" || field.invalid,
    disabled,
    readOnly,
  }),
  send: machine.send,
  inputEl,
  hiddenEl,
  formInput,
  format: () => format,
  alpha: () => alpha,
  setFocused: (on) => {
    focused = on
  },
  invalidMessage: () => messages().invalid,
  value: () => shown,
})
</script>

<FieldHost
  {...fieldProps}
  scope={COLOR_PICKER_SCOPE}
  rootPart={colorFieldPart("root")}
  id={instance}
  dir={loc.current.dir}
  {...fieldMessages ? { messages: fieldMessages } : {}}
  {...api.rootData}>{@render children?.()}<HiddenInput /></FieldHost
>
