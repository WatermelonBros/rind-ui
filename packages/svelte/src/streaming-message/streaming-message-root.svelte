<script lang="ts">
// Streaming Message parts: wiring only. The machine owns the reveal and the announcements,
// connect every attribute.
import {
  announcerCapability,
  displayedText,
  type StreamingMessageState,
  streamingMessageConnect,
  streamingMessageMachine,
  streamingMessageMessages,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { streamingMessage } from "./context"
import type { StreamingMessageRootProps } from "./types"

const {
  text,
  status,
  smooth,
  announce,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: StreamingMessageRootProps = $props()
const env = useEnvironment(announcerCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const loc = useLocale(() => ownLocale)
const messages = useMessages("streaming-message", streamingMessageMessages, () => ownMessages)
const machineProps = () => ({
  id: instance,
  text,
  status,
  smooth,
  announce,
  messages: messages(),
  lang: loc.current.locale,
})
const machine = useMachine(streamingMessageMachine, machineProps, env)
// Read after hydration, then followed: the server and the first client render agree.
$effect(() =>
  untrack(() => {
    machine.send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
    return env.motion.subscribeReducedMotion((reduced) =>
      machine.send({ type: "MOTION.CHANGED", reduced }),
    )
  }),
)
const view = $derived(machine.view)
const current = $derived(view.state as StreamingMessageState)
const api = $derived(streamingMessageConnect({ instance, state: current, plain: false }))
const renderState = $derived({
  state: current,
  text: displayedText(current, machineProps(), view.context),
  busy: api.busy,
})
streamingMessage.set({ state: () => renderState, instance: () => instance })
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
