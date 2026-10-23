<script lang="ts">
import {
  type ChangeDetails,
  type MarqueeEvent,
  type MarqueeState,
  marqueeConnect,
  marqueeCopies,
  marqueeDuration,
  marqueeMachine,
  marqueeMessages,
  marqueeSpeed,
  partId,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { DEV } from "../dev"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { marqueeContext } from "./context"
import type { MarqueeRenderState, MarqueeRootProps } from "./types"

let {
  paused = $bindable(),
  defaultPaused,
  onPausedChange,
  pauseOnHover = true,
  speed,
  orientation = "horizontal",
  reverse = false,
  autoFill = false,
  messages: ownMessages,
  id,
  child,
  children,
  ...rest
}: MarqueeRootProps = $props()

const env = useEnvironment()
const uid = $props.id()
const instance = $derived(id ?? uid)
const messages = useMessages("marquee", marqueeMessages, () => ownMessages)
const machine = useMachine(
  marqueeMachine,
  () => ({
    paused,
    defaultPaused,
    onPausedChange: (next: boolean, details: ChangeDetails<MarqueeEvent>) => {
      let cancelled = false
      onPausedChange?.(next, {
        ...details,
        cancel: () => {
          cancelled = true
          details.cancel()
        },
      })
      if (!cancelled && paused !== undefined) paused = next
    },
    pauseOnHover,
  }),
  {},
)
// Read after hydration, then followed: the server and the first client render agree.
$effect(() =>
  untrack(() => {
    machine.send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
    return env.motion.subscribeReducedMotion((reduced) =>
      machine.send({ type: "MOTION.CHANGED", reduced }),
    )
  }),
)
$effect(() => {
  const s = speed
  if (!DEV || s === undefined) return
  if (marqueeSpeed(s) !== s)
    console.warn(`[rind-ui] marquee: speed ${s} is below 1 or not finite; using 1`)
})
const state = $derived(machine.view.state as MarqueeState)
const api = $derived(
  marqueeConnect({
    instance,
    state,
    paused: machine.view.values.paused,
    orientation,
    reverse,
    autoFill,
    duration: marqueeDuration(machine.view.context.size, speed),
    ids: { viewport: partId("marquee", instance, "viewport") },
    messages: messages(),
  }),
)
const renderState: MarqueeRenderState = $derived({
  state,
  paused: machine.view.values.paused,
  orientation,
  reverse,
})
marqueeContext.set({
  api: () => api,
  send: machine.send,
  state: () => renderState,
  copies: () => marqueeCopies(state, machine.view.context.size, autoFill),
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
</script>

{#if child}
  {@render child({ props: merged, state: renderState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(renderState)}</div>
{/if}
