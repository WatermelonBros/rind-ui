<script lang="ts">
import {
  adjacentStep,
  announcerCapability,
  type ChangeDetails,
  focusSafely,
  partId,
  type StepperChangeReason,
  type StepperEvent,
  stepperConnect,
  stepperMachine,
  stepperMessages,
  stepReachable,
  stepStatus,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { SvelteMap } from "svelte/reactivity"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { type Registry, stepperContext } from "./context.svelte"
import type { StepperRenderState, StepperRootProps } from "./types"

let {
  count,
  step = $bindable(),
  defaultStep,
  onStepChange,
  linear,
  orientation = "horizontal",
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: StepperRootProps = $props()

const env = useEnvironment(announcerCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const locale = useLocale(() => ownLocale)
const messages = useMessages("stepper", stepperMessages, () => ownMessages)
const disabledMap = new SvelteMap<number, true>()
const completedMap = new SvelteMap<number, boolean>()
const titleMap = new SvelteMap<number, string>()
/** Register / unregister one key of a map (no write when unchanged). Untracked: parts
 * register from their effects and attachments, which must not depend on the maps they write. */
function put<V>(map: SvelteMap<number, V>, index: number, value: V | undefined) {
  untrack(() => {
    if (value === undefined) map.delete(index)
    else if (map.get(index) !== value) map.set(index, value)
  })
  return () => {
    untrack(() => map.delete(index))
  }
}
const contentId = (i: number) => partId("stepper", instance, `content-${i}`)
const disabledSteps = $derived(new Set(disabledMap.keys()))
const completedSteps = $derived(new Map(completedMap))
const titles = $derived(new Map(titleMap))
const machineProps = () => ({
  id: instance,
  count,
  step,
  defaultStep,
  onStepChange: (next: number, d: ChangeDetails<StepperEvent>) => {
    let cancelled = false
    // Sound: every step-writing transition declares one of these reasons (machine).
    onStepChange?.(next, {
      ...d,
      reason: d.reason as unknown as StepperChangeReason,
      cancel: () => {
        cancelled = true
        d.cancel()
      },
    })
    if (!cancelled && step !== undefined) step = next
  },
  linear,
  disabledSteps,
  completedSteps,
  titles,
  messages: messages(),
  lang: locale.current.locale,
})
const machine = useMachine(stepperMachine, machineProps, {
  ...env,
  focusContent: (index: number) => {
    // The press's modality, read now: the focus lands a frame later (after the update that
    // shows the step), when the tracker no longer knows what caused it.
    const modality = env.modality.modality()
    env.scheduler.requestAnimationFrame(() => {
      const el = document.getElementById(contentId(index))
      if (el) void focusSafely(el, env, "programmatic", modality)
    })
  },
})
const api = $derived.by(() => {
  const p = machineProps()
  const current = machine.view.values.step
  return stepperConnect({
    instance,
    step: current,
    count,
    orientation,
    status: (i) => stepStatus(p, current, i),
    reachable: (i) => stepReachable(p, machine.view.context, current, i),
    disabled: (i) => disabledSteps.has(i),
    title: (i) => titles.get(i) ?? "",
    hasNext: adjacentStep(p, current, 1) !== null,
    hasPrev: adjacentStep(p, current, -1) !== null,
    ids: {
      content: contentId,
      description: (i) => partId("stepper", instance, `description-${i}`),
    },
    messages: messages(),
    locale: locale.current.locale,
  })
})
const registry: Registry = {
  disabled: (index, on) => put(disabledMap, index, on ? true : undefined),
  completed: (index, value) => put(completedMap, index, value),
  title: (index, text) => put(titleMap, index, text || undefined),
}
const stepperState: StepperRenderState = $derived({
  step: machine.view.values.step,
  count,
  orientation,
})
stepperContext.set({
  api: () => api,
  state: () => stepperState,
  send: machine.send,
  registry,
  messages,
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: stepperState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(stepperState)}</div>
{/if}
