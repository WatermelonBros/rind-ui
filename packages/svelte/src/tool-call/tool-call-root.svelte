<script lang="ts">
import {
  announcerCapability,
  focusSafely,
  partId,
  toolCallConnect,
  toolCallMachine,
  toolCallMessages,
} from "@rind-ui/core"
import { stripMarker } from "@rind-ui/core/internal"
import { mergeProps } from "../merge-props"
import { attrs, normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { toolCallContext } from "./context"
import type { ToolCallRenderState, ToolCallRootProps } from "./types"

let {
  id,
  name,
  status,
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  onDecision,
  focusOnRequest,
  announce,
  risk = "normal",
  duration,
  messages: ownMessages,
  locale: ownLocale,
  child,
  children,
  ...rest
}: ToolCallRootProps = $props()

// The parts' ids come from a generated root id: `id` is the call's, not the element's.
const instance = $props.id()
const env = useEnvironment(announcerCapability)
const messages = useMessages("tool-call", toolCallMessages, () => ownMessages)
const locale = useLocale(() => ownLocale)
const approvalEl: { current: HTMLElement | null } = { current: null }
const receiptEl: { current: HTMLElement | null } = { current: null }
const approveEl: { current: HTMLElement | null } = { current: null }
const machine = useMachine(
  toolCallMachine,
  () => ({
    id,
    name,
    status,
    ...(open === undefined ? {} : { open }),
    defaultOpen,
    onOpenChange: (o: boolean) => {
      onOpenChange?.(o)
      if (open !== undefined) open = o
    },
    ...(onDecision === undefined ? {} : { onDecision }),
    focusOnRequest,
    announce,
    duration,
    messages: messages(),
    lang: locale.current.locale,
  }),
  {
    ...env,
    focusInside: () => {
      const el = approvalEl.current
      return el?.contains(el.ownerDocument.activeElement) === true
    },
    // After the update that shows the Receipt.
    focusReceipt: () =>
      queueMicrotask(() => {
        if (receiptEl.current)
          void focusSafely(receiptEl.current, env, "programmatic", env.modality.modality())
      }),
    focusApprove: () =>
      queueMicrotask(() => {
        if (approveEl.current) void focusSafely(approveEl.current, env, "programmatic", "keyboard")
      }),
  },
)
const seconds = $derived(duration ?? machine.view.context.measured)
const api = $derived(
  toolCallConnect(
    {
      instance,
      name,
      status,
      open: machine.view.values.open === true,
      approval: machine.view.context.approval,
      decision: machine.view.context.decision,
      duration: seconds,
      risk,
      decides: onDecision !== undefined,
      messages: messages(),
      ids: {
        header: partId("tool-call", instance, "header"),
        content: partId("tool-call", instance, "content"),
      },
    },
    env,
  ),
)
const callState: ToolCallRenderState = $derived({
  status,
  open: machine.view.values.open === true,
  approval: machine.view.context.approval,
  decision: machine.view.context.decision,
  duration: seconds,
})
toolCallContext.set({
  api: () => api,
  send: machine.send,
  state: () => callState,
  name: () => name,
  approvalEl,
  receiptEl,
  approveEl,
})
const merged = $derived(stripMarker(mergeProps(normalizeProps(api.root()), rest)))
</script>

{#if child}
  {@render child({ props: merged, state: callState })}
{:else}
  <div {...attrs(merged)}>{@render children?.(callState)}</div>
{/if}
