<script lang="ts">
import {
  domScrollMetrics,
  type ScrollAreaState as ScrollAreaActivity,
  type ScrollAreaConnectInput,
  scrollAreaConnect,
  scrollAreaMachine,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { SvelteSet } from "svelte/reactivity"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { useModality } from "../use-modality.svelte"
import { type Orientation, scrollAreaContext } from "./context"
import type { ScrollAreaRootProps, ScrollAreaState } from "./types"

const {
  type = "hover",
  hideDelay,
  trackPress,
  id,
  child,
  children,
  ...rest
}: ScrollAreaRootProps = $props()
const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment()
let handle: { measure(): void } | null = null
const machine = useMachine(
  scrollAreaMachine,
  () => ({
    root: instance,
    type,
    hideDelay,
    trackPress,
    onTrack: (h: { measure(): void } | null) => {
      handle = h
    },
  }),
  { ...env, scrollMetrics: domScrollMetrics(env) },
)
/** Re-measures after a change the observers cannot see (a deep descendant resized). */
export function measure() {
  handle?.measure()
}
const bars = new SvelteSet<Orientation>()
// The window's tracker installed while mounted (it records the pointer before a focus).
$effect(() => env.modality.subscribe(() => {}))
const modality = useModality(env.modality, () => machine.view.context.viewportFocused)
const input: ScrollAreaConnectInput = $derived({
  instance,
  state: machine.view.state as ScrollAreaActivity,
  context: machine.view.context,
  type,
  modality: modality.current,
})
const connect = $derived(scrollAreaConnect(input))
scrollAreaContext.set({
  connect: () => connect,
  send: machine.send,
  input: () => input,
  register: (o) => {
    bars.add(o)
    return () => bars.delete(o)
  },
  bars: () => bars,
})
// The Root's id is the instance's: a consumer id names the instance, the part id stays ours.
const merged = $derived(stripMarker(mergeProps(normalizeProps(connect.root(machine.send)), rest)))
const current: ScrollAreaState = $derived({ state: input.state })
</script>

{#if child}
  {@render child({ props: merged, state: current })}
{:else}
  <div {...attrs(merged)}>{@render children?.(current)}</div>
{/if}
