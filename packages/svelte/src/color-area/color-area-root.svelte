<script lang="ts">
// Color Area parts: wiring only. The machine owns the colour, connect every attribute; here
// the two axis inputs are reached for property sync, reset and native adoption, and the Root's
// press is measured once by pointer-drag (2D).
import {
  type Color,
  type ColorCommitDetails,
  type ColorSpace,
  focusSafely,
  hiddenFormInput,
  isDragPress,
  type Modality,
  makeColor,
  partId,
  pointerDragSession2D,
  textSelection,
} from "@rind-ui/core"
import {
  areaAxes,
  areaValueOf,
  areaWorking,
  type ColorAreaReason,
  colorAreaConnect,
  colorAreaMachine,
  colorAreaMessages,
  stripMarker,
  thumbPoint,
} from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { useColorProp } from "../color-input"
import { joinHandlers, mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { type Axis, colorArea } from "./context"
import type { ColorAreaRootProps } from "./types"

let {
  value = $bindable(),
  defaultValue: defaultProp,
  onValueChange,
  onValueCommit,
  colorSpace,
  xChannel,
  yChannel,
  xName,
  yName,
  form,
  disabled = false,
  readOnly = false,
  colorName,
  locale: ownLocale,
  dir: ownDir,
  messages: ownMessages,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  child,
  children,
  ...rest
}: ColorAreaRootProps = $props()
const DEFAULT = makeColor("hsb", [0, 0, 100])
const env = useEnvironment()
const uid = $props.id()
const instance = $derived(id ?? uid)
const loc = useLocale(
  () => ownLocale,
  () => ownDir,
)
const messages = useMessages("color-area", colorAreaMessages, () => ownMessages)
const parsed = useColorProp(() => value, "value", "color-area")
const parsedDefault = useColorProp(() => defaultProp, "defaultValue", "color-area")
const controlled = untrack(() => value !== undefined)
// The space of the axes: the prop, else the first colour's (read once), else hsb.
const firstSpace: ColorSpace = untrack(() => (parsed() ?? parsedDefault())?.space ?? "hsb")
const axes = $derived(areaAxes(colorSpace ?? firstSpace, xChannel, yChannel))
const inputs: Record<Axis, HTMLInputElement | null> = { x: null, y: null }
const thumb: { current: HTMLElement | null } = { current: null }
const formInputs = new Map<Axis, ReturnType<typeof hiddenFormInput>>()
const formInput = (axis: Axis) => {
  let cap = formInputs.get(axis)
  if (!cap) {
    cap = hiddenFormInput({ input: () => inputs[axis] }, env)
    formInputs.set(axis, cap)
  }
  return cap
}
const drag = pointerDragSession2D()
const machineEnv = {
  inputs: {
    sync: (x: number, y: number, dispatch: readonly [boolean, boolean]) => {
      formInput("x").sync({ value: String(x) }, { dispatch: dispatch[0] })
      formInput("y").sync({ value: String(y) }, { dispatch: dispatch[1] })
    },
  },
  drag,
  focusAxis: (axis: Axis, modality: Modality) => {
    const el = inputs[axis]
    if (el) void focusSafely(el, env, "programmatic", modality)
  },
}
const machineProps = () => ({
  value: parsed(),
  defaultValue: parsedDefault(),
  axes,
  fallback: DEFAULT,
  disabled,
  readOnly,
  onValueChange: (c: Color, d: { reason: string; cancel(): void }) => {
    // A form reset reports nothing (spec "Form Participation").
    if (d.reason === "RESET") return
    onValueChange?.(c, { reason: d.reason as ColorAreaReason, space: axes.space, cancel: d.cancel })
    if (controlled) value = c
  },
  onValueCommit: (c: Color, d: ColorCommitDetails<ColorAreaReason>) => onValueCommit?.(c, d),
})
const machine = useMachine(colorAreaMachine, machineProps, machineEnv)
const view = $derived(machine.view)
const color = $derived(areaWorking(machineProps(), view.context, view.values.value))
const modality = useModality(env.modality, () => view.context.focused !== null)
const dragging = $derived(view.matches("dragging"))
const api = $derived(
  colorAreaConnect({
    instance,
    color,
    memory: view.context.memory,
    axes,
    dir: loc.current.dir,
    disabled,
    readOnly,
    dragging,
    focused: view.context.focused,
    tabStop: view.context.tabStop,
    changed: view.context.changed,
    modality: modality.current,
    messages: messages(),
    locale: loc.current.locale,
    colorName,
    ariaLabel: ariaLabel ?? undefined,
    ariaLabelledBy: ariaLabelledBy ?? undefined,
    ariaDescribedBy: ariaDescribedBy ?? undefined,
    ids: { root: instance, input: (axis) => partId("color-area", instance, `input-${axis}`) },
    names: { x: xName, y: yName },
    form,
    defaultColor: areaValueOf({ ...machineProps(), value: undefined }, undefined),
  }),
)
// The values each input shows (hydration, a parent's change); no events.
const shown = $derived({
  x: Number(api.input("x")["aria-valuenow"]),
  y: Number(api.input("y")["aria-valuenow"]),
})
$effect(() => {
  const s = shown
  untrack(() => {
    formInput("x").sync({ value: String(s.x) }, { dispatch: false })
    formInput("y").sync({ value: String(s.y) }, { dispatch: false })
  })
})
// The modality tracker must see the pointerdown that comes before the input's focus.
$effect(() => env.modality.subscribe(() => {}))
let selection: (() => void) | null = null
$effect(() => {
  if (dragging) return
  untrack(() => {
    selection?.()
    selection = null
  })
})
const state = $derived({ color, dragging, disabled, readOnly })
colorArea.set({
  api: () => api,
  state: () => state,
  send: machine.send,
  inputs,
  formInput,
  shown: () => shown,
  thumb,
  dir: () => loc.current.dir,
})
const press = (e: PointerEvent) => {
  if (!isDragPress(e) || drag.active || disabled) return
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
  const surface = e.currentTarget as HTMLElement
  const onThumb = thumb.current?.contains(e.target as Node) === true
  const p = thumbPoint(color, axes, view.context.memory)
  const anchor = onThumb ? { x: Number(p.x), y: Number(p.y) } : undefined
  const point = drag.press(surface, e, { dir: loc.current.dir, anchor })
  // Focus goes to the x input (the machine moves it): the browser must not blur it.
  e.preventDefault()
  const touch = e.pointerType === "touch"
  if (touch && !readOnly) selection = textSelection(surface, env, true)
  machine.send({ type: "POINTER.DOWN", point, onThumb, modality: touch ? "touch" : "pointer" })
}
const merged = $derived(
  stripMarker(mergeProps(joinHandlers(normalizeProps(api.root()), { onpointerdown: press }), rest)),
)
</script>

{#if child}
  {@render child({ props: merged, state })}
{:else}
  <div {...attrs(merged)}>{@render children?.(state)}</div>
{/if}
