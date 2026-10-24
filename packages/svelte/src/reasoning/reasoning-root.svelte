<script lang="ts">
// Reasoning parts: wiring only. The machine owns the thinking lifecycle and the disclosure,
// connect every attribute.
import {
  announcerCapability,
  type ChangeDetails,
  partId,
  type ReasoningEvent,
  reasoningConnect,
  reasoningDuration,
  reasoningMachine,
  reasoningMessages,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { reasoning } from "./context"
import type { ReasoningRootProps } from "./types"

let {
  thinking,
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  duration,
  autoCloseDelay,
  announce,
  messages: ownMessages,
  locale: ownLocale,
  id,
  child,
  children,
  ...rest
}: ReasoningRootProps = $props()
const env = useEnvironment(announcerCapability)
const uid = $props.id()
const instance = $derived(id ?? uid)
const loc = useLocale(() => ownLocale)
const messages = useMessages("reasoning", reasoningMessages, () => ownMessages)
const content: { current: Element | null } = { current: null }
const machineProps = () => ({
  id: instance,
  thinking,
  open,
  defaultOpen,
  onOpenChange: (next: boolean, details: ChangeDetails<ReasoningEvent>) => {
    onOpenChange?.(next, details)
    if (open !== undefined) open = next
  },
  duration,
  autoCloseDelay,
  announce,
  messages: messages(),
  lang: loc.current.locale,
})
const machine = useMachine(reasoningMachine, machineProps, {
  ...env,
  focusInside: () => {
    const el = content.current
    return el?.contains(el.ownerDocument.activeElement) === true
  },
})
const view = $derived(machine.view)
const renderState = $derived({
  open: view.values.open,
  thinking: view.state === "thinking",
  duration: reasoningDuration(machineProps(), view.context),
})
const api = $derived(
  reasoningConnect({
    instance,
    open: renderState.open,
    thinking: renderState.thinking,
    duration: renderState.duration,
    ids: { content: partId("reasoning", instance, "content") },
    messages: messages(),
    locale: loc.current.locale,
  }),
)
reasoning.set({ api: () => api, state: () => renderState, send: machine.send, content })
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
