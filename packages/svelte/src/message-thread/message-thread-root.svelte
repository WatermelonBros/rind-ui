<script lang="ts">
// Message Thread parts: wiring only. The machine owns following and the unread count, connect
// every attribute; core's stick-to-bottom reads the viewport's scrolling and growth.
import {
  type MessageThreadState,
  messageThreadConnect,
  messageThreadMachine,
  messageThreadMessages,
  type StickController,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { untrack } from "svelte"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { articles, messageThread } from "./context"
import type { MessageThreadRootProps } from "./types"

const {
  count,
  total,
  lastFromUser = false,
  anchor = "bottom",
  bottomThreshold = 32,
  loadingOlder = false,
  onLoadOlder,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: MessageThreadRootProps = $props()
const env = useEnvironment()
const uid = $props.id()
const instance = $derived(id ?? uid)
const loc = useLocale(() => ownLocale)
const messages = useMessages("message-thread", messageThreadMessages, () => ownMessages)
const stick: { current: StickController | null } = { current: null }
const viewport: { current: HTMLElement | null } = { current: null }
/** The Viewport's top-layout reveal (it owns the reserve below the turn). */
const turn: { current: ((b: "smooth" | "instant") => void) | null } = { current: null }
const machine = useMachine(messageThreadMachine, () => ({ count, lastFromUser, anchor }), {
  scrollToBottom: (b: "smooth" | "instant") => stick.current?.scrollToBottom(b),
  revealTurn: (b: "smooth" | "instant") => turn.current?.(b),
  focusLast: () => {
    const last = viewport.current ? articles(viewport.current).at(-1) : undefined
    last?.focus({ preventScroll: true })
  },
})
$effect(() =>
  untrack(() => {
    machine.send({ type: "MOTION.CHANGED", reduced: env.motion.reducedMotion() })
    return env.motion.subscribeReducedMotion((reduced) =>
      machine.send({ type: "MOTION.CHANGED", reduced }),
    )
  }),
)
let bottom = $state(true)
const view = $derived(machine.view)
const threadState = $derived(view.state as MessageThreadState)
const api = $derived(
  messageThreadConnect({
    instance,
    state: threadState,
    anchor,
    count,
    total,
    unread: view.context.unread,
    atBottom: bottom,
    loadingOlder,
    messages: messages(),
    locale: loc.current.locale,
  }),
)
const renderState = $derived({
  state: threadState,
  anchor,
  unread: view.context.unread,
  atBottom: bottom,
})
messageThread.set({
  api: () => api,
  state: () => renderState,
  send: machine.send,
  threshold: () => bottomThreshold,
  loadingOlder: () => loadingOlder,
  loadOlder: () => onLoadOlder?.(),
  setAtBottom: (at) =>
    untrack(() => {
      bottom = at
    }),
  stick,
  viewport,
  turn,
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
