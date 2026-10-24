<script lang="ts">
import {
  type ChangeDetails,
  focusSafely,
  fractionOf,
  hiddenFormInput,
  isDragPress,
  type Modality,
  mergeFieldProps,
  normalizeValues,
  partId,
  pointerDragSession,
  resolveSlider,
  type SliderCommitDetails,
  type SliderEvent,
  type SliderPart,
  type SliderReason,
  sameNumbers,
  sliderConnect,
  sliderDragAxis,
  sliderMachine,
  sliderMessages,
  sliderRange,
  textSelection,
  thumbValueTexts,
  watchFieldsetDisabled,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useFieldControl } from "../field/context.svelte"
import { useFieldsetDisabled } from "../fieldset/context"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { sliderContext, sliderNaming, sliderRootSurface } from "./context"
import type { SliderRootProps, SliderState, SliderValue } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  onValueCommit,
  min,
  max,
  step,
  largeStep,
  minStepsBetweenThumbs,
  thumbCollision,
  thumbAlignment = "center",
  orientation = "horizontal",
  disabled = false,
  readonly: readOnly = false,
  required = false,
  invalid = false,
  name,
  form,
  formatOptions,
  locale: ownLocale,
  dir: ownDir,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: SliderRootProps = $props()

const toArray = (v: SliderValue | undefined): readonly number[] | undefined =>
  v === undefined ? undefined : typeof v === "number" ? [v] : v
const env = useEnvironment()
const uid = $props.id()
const instance = $derived(id ?? uid)
const locale = useLocale(
  () => ownLocale,
  () => ownDir,
)
const messages = useMessages("slider", sliderMessages, () => ownMessages)
const binding = useFieldControl(uid)
const fieldsetContext = useFieldsetDisabled()
let fieldsetDom = $state(false)
const registry = usePartRegistry<"label" | "description">(
  untrack(() => ({ scope: "slider", root: instance })),
)
const ownLabel = useRenderedId(registry, "label")
const ownDescription = useRenderedId(registry, "description")
const scalar = $derived(!Array.isArray(value ?? defaultValue))
const range = $derived(sliderRange({ min, max, step, largeStep, minStepsBetweenThumbs }))
// Normalised once, at creation (grid, order, gap: ZG#2488); later defaults change a reset only.
const creationDefault = untrack(() =>
  normalizeValues(toArray(defaultValue) ?? [range.min], range, "defaultValue"),
)
const inputs: (HTMLInputElement | null)[] = []
const thumbs: (Element | null)[] = []
const control: { current: Element | null } = { current: null }
const rootSurface = sliderRootSurface.maybe() ?? false
const naming = sliderNaming.maybe() ?? null
// Its parts under a host's names when the Slider is another component's part.
const scopeName = naming?.scope ?? "slider"
const partNamed = (part: SliderPart) => naming?.part(part) ?? part
let latest: readonly number[] = creationDefault
let thumbDisabled: readonly boolean[] = $state([])
const setThumbDisabled = (index: number, off: boolean | undefined) => {
  const prev = untrack(() => thumbDisabled)
  if ((prev[index] === true) === (off === true)) return
  const next = [...prev]
  next[index] = off === true
  thumbDisabled = next
}
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
      describedBy: ownDescription.current,
    },
    binding?.() ?? null,
  ),
)
// One hidden-form-input per thumb input (sync, reset, adoption); created on first use.
const formInputs = new Map<number, ReturnType<typeof hiddenFormInput>>()
const formInput = (index: number) => {
  let cap = formInputs.get(index)
  if (!cap) {
    cap = hiddenFormInput({ input: () => inputs[index] ?? null }, env)
    formInputs.set(index, cap)
  }
  return cap
}
const focusThumb = (index: number, modality: Modality) => {
  const el = inputs[index]
  if (el) void focusSafely(el, env, "programmatic", modality)
}
const drag = pointerDragSession()
const texts = (vs: readonly number[]) =>
  thumbValueTexts({
    values: vs,
    locale: locale.current.locale,
    formatOptions,
    messages: messages(),
  })
const shape = (v: readonly number[]): SliderValue => (scalar ? (v[0] ?? range.min) : v)
let lastReason: SliderReason | null = null
const machineProps = () => {
  const valueArray = toArray(value)
  if (valueArray) normalizeValues(valueArray, range, "value") // development warning only
  return {
    value: valueArray,
    defaultValue: toArray(defaultValue) ?? creationDefault,
    min,
    max,
    step,
    largeStep,
    minStepsBetweenThumbs,
    thumbCollision,
    disabled: field.disabled,
    readOnly: field.readOnly,
    thumbDisabled,
    onValueChange: (next: readonly number[], details: ChangeDetails<SliderEvent>) => {
      lastReason = details.reason
      const before = latest
      if (value === undefined) {
        // Uncontrolled: the inputs already show the value when the consumer runs (a
        // requestSubmit() there submits it); a cancel re-syncs them ($reverted).
        const t = texts(next)
        next.forEach((v, i) => {
          formInput(i).sync({ value: String(v) }, { dispatch: false })
          inputs[i]?.setAttribute("aria-valuenow", String(v))
          const text = t[i]
          if (text !== undefined) inputs[i]?.setAttribute("aria-valuetext", text)
        })
      }
      let cancelled = false
      onValueChange?.(shape(next), {
        reason: details.reason,
        index: Math.max(
          0,
          next.findIndex((v, i) => v !== before[i]),
        ),
        event: details.event,
        cancel: () => {
          cancelled = true
          details.cancel()
        },
      })
      if (!cancelled && value !== undefined) value = shape(next)
    },
    onValueCommit: (next: readonly number[], details: SliderCommitDetails) => {
      binding?.().report({ type: "commit" })
      onValueCommit?.(shape(next), details)
    },
  }
}
const machine = useMachine(sliderMachine, machineProps, {
  inputs: {
    sync: (vs: readonly number[], dispatch: readonly boolean[]) =>
      vs.forEach((v, i) => {
        formInput(i).sync({ value: String(v) }, { dispatch: dispatch[i] === true })
      }),
  },
  drag,
  focusThumb,
})
const values = $derived(resolveSlider(machineProps(), machine.view.values.value).values)
const focused = $derived(machine.view.context.focused)
const modality = useModality(env.modality, () => focused !== null)
const dragging = $derived(machine.view.matches("dragging"))
const api = $derived(
  sliderConnect({
    instance,
    ...(naming ? { naming } : {}),
    values,
    range,
    orientation,
    dir: locale.current.dir,
    alignment: thumbAlignment,
    field,
    fieldData: binding?.().data,
    thumbDisabled,
    focused,
    modality: modality.current,
    active: machine.view.context.active,
    draggingThumb: machine.view.context.dragging,
    dragging,
    ids: {
      root: instance,
      label: partId("slider", instance, "label"),
      description: partId("slider", instance, "description"),
      input: (n: number) => partId("slider", instance, `input-${n}`),
    },
    labelledBy: binding?.().ids.label ?? ownLabel.current,
    locale: locale.current.locale,
    formatOptions,
    messages: messages(),
    form,
    defaultValues: normalizeValues(toArray(defaultValue) ?? creationDefault, range),
  }),
)
// After every update: each input shows the value (hydration, a parent's change); no events.
$effect(() => {
  const now = values
  untrack(() => {
    latest = now
    for (const [i, v] of now.entries()) formInput(i).sync({ value: String(v) }, { dispatch: false })
  })
})
$effect(() =>
  untrack(() => {
    const offs: (() => void)[] = []
    const node = control.current ?? inputs[0] ?? null
    if (node) {
      const w = watchFieldsetDisabled(node, (d) => (fieldsetDom = d))
      fieldsetDom = w.disabled
      offs.push(w.stop)
    }
    // field-control: one control; the first thumb input is its validity element.
    if (binding) {
      const first = partId("slider", instance, "input-0")
      offs.push(
        binding().register(
          {
            id: first,
            labelable: false,
            focus: (m) => focusThumb(0, m),
            validityElement: () => inputs[0] ?? null,
            value: () => values,
          },
          first,
        ),
      )
    }
    return () => {
      for (const off of offs) off()
    }
  }),
)
let reported = untrack(() => values)
$effect(() => {
  const now = values
  untrack(() => {
    if (sameNumbers(reported, now)) return
    reported = now
    const user = lastReason !== null && lastReason !== "RESET"
    lastReason = null
    binding?.().report({ type: "change", value: now, user, composing: false })
  })
})
// A touch drag (iOS): no text selection or callout while it lasts (BU#1295).
let selection: (() => void) | null = null
$effect(() => {
  if (dragging) return
  untrack(() => {
    selection?.()
    selection = null
  })
})
const sliderState: SliderState = $derived({
  values,
  dragging,
  disabled: field.disabled,
  readOnly: field.readOnly,
  orientation,
})
const press = (e: PointerEvent) => {
  if (!isDragPress(e) || drag.active || field.disabled || field.readOnly) return
  const surface = e.currentTarget
  if (!(surface instanceof HTMLElement)) return
  const thumb = (e.target as Element | null)?.closest?.(
    `[data-scope="${scopeName}"][data-part="${partNamed("thumb")}"]`,
  )
  // A disabled thumb is no target: the press is a track press there.
  const index =
    thumb &&
    thumb.getAttribute("data-instance") === instance &&
    !thumb.hasAttribute("data-disabled")
      ? Number(thumb.getAttribute("data-index"))
      : null
  const anchor = index === null ? undefined : fractionOf(values[index] ?? range.min, range)
  const contain = thumbAlignment === "contain" ? (thumbs[index ?? 0] ?? null) : null
  const fraction = drag.press(surface, e, {
    ...sliderDragAxis(
      { orientation, dir: locale.current.dir },
      contain instanceof HTMLElement ? contain : null,
    ),
    anchor,
  })
  // Focus goes to the thumb input (the machine moves it): the browser must not blur it.
  e.preventDefault()
  const touch = e.pointerType === "touch"
  if (touch) selection = textSelection(surface, env, true)
  machine.send({
    type: "POINTER.DOWN",
    fraction,
    thumb: index,
    modality: touch ? "touch" : "pointer",
  })
}
// Color Slider only: without a Control part its Root is the pointer surface; presses that
// start on the Label or the ValueText do not start a drag.
const rootPress = (e: PointerEvent) => {
  if (!rootSurface || control.current) return
  const from = (e.target as Element | null)?.closest?.(`[data-scope="${scopeName}"][data-part]`)
  const partName = from?.getAttribute("data-part")
  if (
    partName === partNamed("label") ||
    partName === partNamed("value-text") ||
    partName === partNamed("description")
  )
    return
  press(e)
}
sliderContext.set({
  instance: () => instance,
  api: () => api,
  state: () => sliderState,
  send: machine.send,
  registry,
  inputs,
  thumbs,
  control,
  values: () => values,
  formInput,
  setThumbDisabled,
  press,
  inField: binding !== null,
  orientation: () => orientation,
  dir: () => locale.current.dir,
})
const merged = $derived(
  stripMarker(
    mergeProps(joinHandlers(normalizeProps(api.root()), { onpointerdown: rootPress }), rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: sliderState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(sliderState)}</div>
{/if}
