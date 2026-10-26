<script lang="ts">
import {
  type AngleSliderEvent,
  type AngleSliderReason,
  angleSliderMachine,
  type ChangeDetails,
  type Color,
  type ColorMemory,
  colorWheelConnect,
  colorWheelMessages,
  colorWithHue,
  focusSafely,
  hiddenFormInput,
  hueOf,
  isDragPress,
  type Modality,
  makeColor,
  onRing,
  partId,
  pointerAngleSession,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useColorProp } from "../color-input"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { colorWheelContext } from "./context"
import type { ColorWheelRenderState, ColorWheelRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue,
  onValueChange,
  onValueCommit,
  colorSpace,
  step = 1,
  largeStep,
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
}: ColorWheelRootProps = $props()

const DEFAULT = makeColor("hsl", [0, 100, 50])
/** The ring's width when the theme sets no `--rind-color-wheel-thickness`. */
const THICKNESS = 30

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment()
const locale = useLocale(() => ownLocale)
const messages = useMessages("color-wheel", colorWheelMessages, () => ownMessages)
const registry = usePartRegistry<"label">(untrack(() => ({ scope: "color-wheel", root: instance })))
const ownLabel = useRenderedId(registry, "label")
const ids = $derived({
  label: partId("color-wheel", instance, "label"),
  input: partId("color-wheel", instance, "input"),
})
const controlled = useColorProp(() => value, "value", "color-wheel")
const defaultProp = useColorProp(() => defaultValue, "defaultValue", "color-wheel")
const defaultColor = $derived(defaultProp() ?? DEFAULT)
let own: Color = $state(untrack(() => defaultColor))
const color = $derived(controlled() ?? own)
// The hue a grey keeps (a grey's own hue is lost in a round trip through hex or rgb).
let memory: ColorMemory = $state({})
const hue = $derived(hueOf(color, step, memory))
let latest: Color = untrack(() => color)
const input: { current: HTMLInputElement | null } = { current: null }
const thumb: { current: HTMLElement | null } = { current: null }
let hexEl: HTMLInputElement | null = null
const rangeInput = hiddenFormInput({ input: () => input.current }, env)
const hexForm = hiddenFormInput({ input: () => hexEl }, env)
const drag = pointerAngleSession()
let focused = $state(false)
const modality = useModality(env.modality, () => focused)
// The modality tracker must see the pointerdown that comes before the input's focus.
$effect(() => env.modality.subscribe(() => {}))
// The hue is always controlled: the colour is the source, held here when uncontrolled.
const machine = useMachine(
  angleSliderMachine,
  () => ({
    value: hue,
    step,
    largeStep,
    wrap: true,
    disabled,
    readOnly,
    onValueChange: (h: number, d: ChangeDetails<AngleSliderEvent>) => {
      memory = { ...memory, hue: h }
      const next = colorWithHue(color, h, colorSpace, memory)
      latest = next
      if (value === undefined) own = next
      else value = next
      onValueChange?.(next, d)
    },
    onValueCommit: (_h: number, d: { readonly reason: AngleSliderReason }) =>
      onValueCommit?.(latest, d),
  }),
  {
    drag,
    focusInput: (m: Modality) => {
      if (input.current) void focusSafely(input.current, env, "programmatic", m)
    },
  },
)
const dragging = $derived(machine.view.state === "dragging")
const api = $derived(
  colorWheelConnect({
    instance,
    color,
    memory,
    step,
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
    defaultColor,
  }),
)
const hex = $derived(String(api.hiddenInput()["value"]))
// Both inputs show the value after every update (a drag, a parent's change); no events.
$effect(() => {
  const h = hue
  const x = hex
  untrack(() => {
    latest = color
    rangeInput.sync({ value: String(h) }, { dispatch: false })
    hexForm.sync({ value: x }, { dispatch: false })
  })
})
$effect(() =>
  untrack(() =>
    hexForm.track({
      // The whole colour back to the default (not only its hue), with no callback.
      onReset: () => {
        memory = {}
        machine.send({ type: "DRAG.CANCEL" })
        own = defaultColor
      },
      current: () => ({ value: hex }),
    }),
  ),
)
const wheelState: ColorWheelRenderState = $derived({
  color,
  hue,
  dragging,
  disabled,
  readOnly,
})
const press = (e: PointerEvent) => {
  if (!isDragPress(e) || drag.active || disabled) return
  const track = e.currentTarget as HTMLElement
  const thickness =
    Number.parseFloat(getComputedStyle(track).getPropertyValue("--rind-color-wheel-thickness")) ||
    THICKNESS
  if (!onRing(track, e, thickness)) return
  const onThumb = thumb.current?.contains(e.target as Node) === true
  const angle = drag.press(track, e, onThumb ? hue : undefined)
  // Focus goes to the input (the machine moves it): the browser must not blur it.
  e.preventDefault()
  machine.send({
    type: "POINTER.DOWN",
    angle,
    onThumb,
    modality: e.pointerType === "touch" ? "touch" : "pointer",
  })
}
colorWheelContext.set({
  api: () => api,
  send: machine.send,
  state: () => wheelState,
  registry,
  labelId: () => ids.label,
  input,
  thumb,
  press,
  setFocused: (f) => (focused = f),
  rangeInput,
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
// The hex is written as a property by hiddenFormInput (the same markup as React).
const hidden = $derived.by(() => {
  const { value: _hex, ...h } = normalizeProps(api.hiddenInput())
  return h
})
const captureHex = (node: HTMLInputElement) => {
  hexEl = node
  return () => {
    if (hexEl === node) hexEl = null
  }
}
</script>

{#snippet hiddenInput()}<input {...attrs(hidden)} {@attach captureHex} />{/snippet}

{#if child}
  {@render child({ props: merged, state: wheelState })}{@render hiddenInput()}
{:else}
  <div {...attrs(merged)}>{@render children?.(wheelState)}{@render hiddenInput()}</div>
{/if}
