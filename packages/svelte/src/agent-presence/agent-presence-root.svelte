<script lang="ts">
import {
  type AgentState,
  agentPresenceConnect,
  agentPresenceMachine,
  agentPresenceMessages,
  announcerCapability,
  partId,
  startLevelLoop,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { usePartRegistry, useRenderedId } from "../use-ids.svelte"
import { useMachine } from "../use-machine.svelte"
import { agentPresenceContext } from "./context"
import type { AgentPresenceRenderState, AgentPresenceRootProps } from "./types"

const {
  state: agentState,
  reason,
  muted = false,
  getLevel,
  announce,
  thinkingDelay,
  staleAfter,
  motion: motionProp = "auto",
  onStateChange,
  onStale,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: AgentPresenceRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment(announcerCapability)
const messages = useMessages("agent-presence", agentPresenceMessages, () => ownMessages)
const locale = useLocale(() => ownLocale)
const registry = usePartRegistry<"status">(
  untrack(() => ({ scope: "agent-presence", root: instance })),
)
const composed = useRenderedId(registry, "status")
let reduced = $state(untrack(() => env.motion.reducedMotion()))
$effect(() => env.motion.subscribeReducedMotion((r) => (reduced = r)))
const motion = $derived(motionProp === "off" ? "off" : reduced ? "reduced" : "full")
const machine = useMachine(
  agentPresenceMachine,
  () => ({
    state: agentState,
    reason,
    muted,
    announce,
    thinkingDelay,
    staleAfter,
    onStale: (s: AgentState) => onStale?.(s),
    onStateChange: (s: AgentState, d: { from: AgentState }) => onStateChange?.(s, d),
    messages: messages(),
    id: instance,
    lang: locale.current.locale,
  }),
  env,
)
const api = $derived(
  agentPresenceConnect({
    instance,
    state: machine.view.context.current,
    previous: machine.view.context.previous,
    stale: machine.view.context.stale,
    muted,
    motion,
    reason,
    messages: messages(),
  }),
)
const presenceState: AgentPresenceRenderState = $derived({
  state: machine.view.context.current,
  previous: machine.view.context.previous,
  stale: machine.view.context.stale,
  muted,
  motion,
})
agentPresenceContext.set({
  api: () => api,
  state: () => presenceState,
  registry,
  statusId: () => partId("agent-presence", instance, "status"),
})
// The level is written to the Root each frame, outside rendering (design §4).
let rootEl: HTMLElement | undefined = $state()
const channel = $derived(getLevel ? api.levelChannel : null)
$effect(() => {
  const el = rootEl
  const c = channel
  if (!el || c === null) return
  return untrack(() =>
    startLevelLoop(el, {
      channel: c,
      getLevel: (ch) => getLevel?.(ch) ?? 0,
      scheduler: env.scheduler,
      now: () => env.clock.now(),
    }),
  )
})
const merged = $derived(
  stripMarker(
    mergeProps({ ...normalizeProps(api.root()), ...(id === undefined ? {} : { id }) }, rest),
  ),
)
const capture = (node: HTMLElement) => {
  rootEl = node
  return () => {
    if (rootEl === node) rootEl = undefined
  }
}
</script>

{#snippet hidden()}{#if composed.current === undefined}<span {...attrs(normalizeProps(api.hiddenStatus()))}>{api.statusText}</span>{/if}{/snippet}

{#if child}
  {@render child({ props: merged, state: presenceState })}
{:else}
  <div {...attrs(merged)} {@attach capture}>{@render children?.(presenceState)}{@render hidden()}</div>
{/if}
