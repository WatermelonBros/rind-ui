<script lang="ts">
import {
  announcerCapability,
  type TimerState,
  type TimerTickDetails,
  timerConfig,
  timerConnect,
  timerMachine,
  timerMessages,
  visibilityCapability,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { timerContext } from "./context.svelte"
import type { TimerRenderState, TimerRootProps } from "./types"

const {
  countdown,
  startMs,
  targetMs,
  autoStart,
  interval,
  onTick,
  onComplete,
  onStateChange,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: TimerRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment(announcerCapability, visibilityCapability)
const messages = useMessages("timer", timerMessages, () => ownMessages)
const locale = useLocale(() => ownLocale)
const machineProps = () => ({
  countdown,
  startMs,
  targetMs,
  autoStart,
  interval,
  messages: messages(),
  id: instance,
  lang: locale.current.locale,
  onTick: (d: TimerTickDetails) => onTick?.(d),
  onComplete: () => onComplete?.(),
  onStateChange: (s: TimerState) => onStateChange?.(s),
})
const machine = useMachine(timerMachine, machineProps, env)
const api = $derived(
  timerConnect(
    {
      instance,
      state: machine.view.state,
      value: machine.view.context.value,
      config: timerConfig(machineProps()),
      locale: locale.current.locale,
      messages: messages(),
    },
    env,
  ),
)
const timerState: TimerRenderState = $derived({
  state: machine.view.state,
  value: machine.view.context.value,
  progress: api.progress,
})
timerContext.set({
  api: () => api,
  send: machine.send,
  state: () => timerState,
  messages: () => messages(),
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: timerState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(timerState)}</div>
{/if}
