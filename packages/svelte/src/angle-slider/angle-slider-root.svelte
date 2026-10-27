<script lang="ts">
import {
  type AngleSliderEvent,
  type AngleSliderReason,
  angleSliderConnect,
  angleSliderMachine,
  angleSliderMessages,
  angleValueOf,
  type ChangeDetails,
  focusSafely,
  hiddenFormInput,
  isDragPress,
  type Modality,
  partId,
  pointerAngleSession,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { angleSliderContext } from "./context"
import type { AngleSliderRenderState, AngleSliderRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  onValueCommit,
  step,
  largeStep,
  wrap,
  disabled = false,
  readonly: readOnly = false,
  invalid = false,
  name,
  form,
  locale: ownLocale,
  messages: ownMessages,
  id,
  child,
  children,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: AngleSliderRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment()
const locale = useLocale(() => ownLocale)
const messages = useMessages("angle-slider", angleSliderMessages, () => ownMessages)
const registry = usePartRegistry<"label">(
  untrack(() => ({ scope: "angle-slider", root: instance })),
)
const ownLabel = useRenderedId(registry, "label")
const ids = $derived({
  label: partId("angle-slider", instance, "label"),
  input: partId("angle-slider", instance, "input"),
})
const input: { current: HTMLInputElement | null } = { current: null }
const thumb: { current: HTMLElement | null } = { current: null }
const formInput = hiddenFormInput({ input: () => input.current }, env)
const drag = pointerAngleSession()
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
// The modality tracker must see the pointerdown that comes before the input's focus.
$effect(() => env.modality.subscribe(() => {}))
const machineProps = () => ({
  value,
  defaultValue,
  onValueChange: (v: number, d: ChangeDetails<AngleSliderEvent>) => {
    onValueChange?.(v, d)
    if (value !== undefined) value = v
  },
  onValueCommit: (v: number, d: { readonly reason: AngleSliderReason }) => onValueCommit?.(v, d),
  step,
  largeStep,
  wrap,
  disabled,
  readOnly,
})
const machine = useMachine(angleSliderMachine, machineProps, {
  drag,
  focusInput: (m: Modality) => {
    if (input.current) void focusSafely(input.current, env, "programmatic", m)
  },
})
const current = $derived(angleValueOf(machineProps(), machine.view.values.value))
const dragging = $derived(machine.view.state === "dragging")
const api = $derived(
  angleSliderConnect({
    instance,
    value: current,
    defaultValue: angleValueOf({ ...machineProps(), value: undefined }, undefined),
    step: step ?? 1,
    dragging,
    disabled,
    readOnly,
    invalid,
    focused,
    modality: modality.current,
    locale: locale.current.locale,
    messages: messages(),
    ariaLabel: ariaLabel ?? undefined,
    ariaLabelledBy: ariaLabelledBy ?? undefined,
    ids: { ...ids, label: ownLabel.current ?? ids.label },
    rendered: { label: ownLabel.current !== undefined },
    name,
    form,
  }),
)
// The input shows the value after every update (a drag, a parent's change); no events.
$effect(() => {
  const now = current
  untrack(() => formInput.sync({ value: String(now) }, { dispatch: false }))
})
const sliderState: AngleSliderRenderState = $derived({
  value: current,
  dragging,
  disabled,
  readOnly,
})
const press = (e: PointerEvent) => {
  if (!isDragPress(e) || drag.active || disabled) return
  const onThumb = thumb.current?.contains(e.target as Node) === true
  const angle = drag.press(e.currentTarget as Element, e, onThumb ? current : undefined)
  // Focus goes to the input (the machine moves it): the browser must not blur it.
  e.preventDefault()
  machine.send({
    type: "POINTER.DOWN",
    angle,
    onThumb,
    modality: e.pointerType === "touch" ? "touch" : "pointer",
  })
}
angleSliderContext.set({
  api: () => api,
  send: machine.send,
  state: () => sliderState,
  registry,
  labelId: () => ids.label,
  input,
  thumb,
  press,
  setFocused: (f) => (focused = f),
  formInput,
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: sliderState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(sliderState)}</div>
{/if}
