<script lang="ts">
// Color Picker parts (design §8): the coordinator machine owns the colour, the format and the
// open state; the Popover is its controlled child (re-scoped to `color-picker`), and every
// colour child (Area, Slider, Field, Channel Field, Swatch Picker, Swatch) is the component of
// its own, bound to the picker's colour. Wiring only.
import {
  type Color,
  type ColorInput,
  type ColorPickerFormat,
  type ColorPickerReason,
  colorPickerConnect,
  colorPickerMachine,
  colorPickerMessages,
  createFlushRegistry,
  formatColor,
  mergeFieldProps,
  partId,
  pickerValueOf,
  pickerWorking,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { useColorProp } from "../color-input"
import { useFieldBindingPeek } from "../field/context.svelte"
import FieldHost from "../field/field-host.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { normalizeProps } from "../normalize-props"
import PopoverRoot from "../popover/popover-root.svelte"
import { useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import HiddenField from "./color-picker-hidden-field.svelte"
import { colorPicker } from "./context"
import type { ColorPickerRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue: defaultProp,
  onValueChange,
  onValueCommit,
  format = $bindable(),
  defaultFormat,
  onFormatChange,
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  inline = false,
  closeOnSelect = false,
  modal,
  positioning,
  initialFocus,
  persistentElements,
  name,
  form,
  formFormat,
  disabled: ownDisabled = false,
  readonly: ownReadonly = false,
  required = false,
  invalid: ownInvalid = false,
  colorName,
  locale: ownLocale,
  dir: ownDir,
  messages: ownMessages,
  children,
  id,
  style,
  ...rest
}: ColorPickerRootProps = $props()

// OR-merged with an enclosing Field, rind's Fieldset and a native <fieldset disabled>
// (spec: passed to every child).
const enclosing = useFieldBindingPeek()
const fieldsetDisabled = useFieldsetDisabled()
let fieldsetDom = $state(false)
const merged = $derived(
  mergeFieldProps(
    {
      role: "group",
      labelable: false,
      disabled: ownDisabled,
      readOnly: ownReadonly,
      invalid: ownInvalid,
    },
    enclosing?.() ?? null,
  ),
)
const disabled = $derived(merged.disabled || fieldsetDisabled() || fieldsetDom)
const readonly = $derived(merged.readOnly)
const invalid = $derived(merged.invalid)

/** The default format of the first colour given: a hex string `hex`, otherwise its space. */
function firstFormat(input: ColorInput | undefined, color: Color | undefined): ColorPickerFormat {
  if (typeof input === "string" && input.trim().startsWith("#")) return "hex"
  return color ? color.space : "hex"
}
const uid = $props.id()
const instance = $derived(id ?? uid)
const loc = useLocale(
  () => ownLocale,
  () => ownDir,
)
const messages = useMessages("color-picker", colorPickerMessages, () => ownMessages)
const parsed = useColorProp(() => value, "value", "color-picker")
const parsedDefault = useColorProp(() => defaultProp, "defaultValue", "color-picker")
const controlled = untrack(() => value !== undefined)
const initialFormat = untrack(
  () => defaultFormat ?? firstFormat(value ?? defaultProp, parsed() ?? parsedDefault()),
)
const fixed = untrack(() => inline)
let latestFormat: ColorPickerFormat = initialFormat
const machineProps = () => ({
  value: parsed(),
  defaultValue: parsedDefault(),
  format,
  defaultFormat: initialFormat,
  open: fixed ? undefined : open,
  defaultOpen: defaultOpen ?? false,
  inline: fixed,
  disabled,
  readOnly: readonly,
  closeOnSelect,
  onValueChange: (c: Color, d: { reason: string; event: unknown; cancel(): void }) => {
    const e = d.event as { reason?: ColorPickerReason; channel?: string }
    const reason = e.reason ?? (d.reason === "RESET" ? "RESET" : "INPUT")
    let refused = false
    onValueChange?.(c, {
      reason,
      space: c.space,
      valueAsString: formatColor(c, latestFormat),
      channel: e.channel,
      cancel: () => {
        refused = true
        d.cancel()
      },
    })
    if (!refused && controlled) value = c
  },
  onValueCommit: (c: Color, d: { readonly reason: ColorPickerReason }) => onValueCommit?.(c, d),
  onFormatChange: (f: ColorPickerFormat) => {
    onFormatChange?.(f)
    if (format !== undefined) format = f
  },
  onOpenChange: (o: boolean, d: { reason: string; event: unknown }) => {
    const event = d.event as { type: string; reason?: string }
    // A transition's own reason ("select", "api") wins; else the Popover's, carried by the event.
    const reason = d.reason !== event.type ? d.reason : (event.reason ?? d.reason)
    onOpenChange?.(o, { reason })
    if (open !== undefined) open = o
  },
})
const machine = useMachine(colorPickerMachine, machineProps, {})
const view = $derived(machine.view)
const current = $derived(view.values.format)
$effect.pre(() => {
  latestFormat = current
})
const color = $derived(pickerWorking(machineProps(), view.context, view.values.value))
const isOpen = $derived(view.values.open === true)
const registry = createFlushRegistry()
let labelRendered = $state(false)
let hiddenPart = $state(false)
const triggerEl: { current: HTMLElement | null } = { current: null }
const api = $derived(
  colorPickerConnect({
    instance,
    color,
    format: current,
    open: isOpen,
    inline: fixed,
    disabled,
    readOnly: readonly,
    invalid,
    dragging: false,
    messages: messages(),
    locale: loc.current.locale,
    colorName,
    ids: {
      control: partId("color-picker", instance, "control"),
      trigger: partId("color-picker", instance, "trigger"),
      label: partId("color-picker", instance, "label"),
      content: partId("color-picker", instance, "content"),
      hiddenInput: partId("color-picker", instance, "hidden-input"),
    },
    labelRendered,
    name,
    form,
    required,
    formFormat,
    defaultValue:
      parsedDefault() ?? pickerValueOf({ ...machineProps(), value: undefined }, undefined),
  }),
)
const pickerState = $derived({
  color,
  format: current,
  open: isOpen,
  inline: fixed,
  disabled,
  readOnly: readonly,
})
colorPicker.set({
  instance: () => instance,
  color: () => color,
  format: () => current,
  state: () => pickerState,
  send: machine.send,
  api: () => api,
  messages,
  locale: () => loc.current.locale,
  dir: () => loc.current.dir,
  inline: fixed,
  colorName: () => colorName,
  registry,
  setLabelRendered: (on) =>
    untrack(() => {
      labelRendered = on
    }),
  setHiddenPart: (on) =>
    untrack(() => {
      hiddenPart = on
    }),
  triggerEl,
  formValue: () => api.formValue,
  setFieldsetDom: (d) => {
    fieldsetDom = d
  },
})
const rootProps = $derived(
  normalizeProps(api.root()) as { style?: string } & Record<string, unknown>,
)
const popoverChange = (next: boolean, d: { reason: string }) => {
  if (next) {
    machine.send({ type: "OPEN", reason: d.reason })
    return
  }
  // Every pending draft commits first (react-spectrum#9748), then the close.
  registry.flushAll()
  machine.send({ type: "CLOSE", reason: d.reason })
}
</script>

{#snippet body()}{@render children?.(pickerState)}{#if !hiddenPart}<HiddenField />{/if}{/snippet}

<FieldHost
  scope="color-picker"
  id={instance}
  dir={loc.current.dir}
  {disabled}
  {readonly}
  {required}
  {invalid}
  {...rest}
  {...rootProps}
  style={[rootProps.style, style].filter(Boolean).join("; ")}
  >{#if fixed}{@render body()}{:else}<PopoverRoot
      id={instance}
      scope="color-picker"
      open={isOpen}
      onOpenChange={popoverChange as never}
      {disabled}
      {...modal === undefined ? {} : { modal }}
      {...positioning === undefined ? {} : { positioning }}
      {...initialFocus === undefined ? {} : { initialFocus }}
      {...persistentElements === undefined ? {} : { persistentElements }}>{@render body()}</PopoverRoot
    >{/if}</FieldHost
>
