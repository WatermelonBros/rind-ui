<script lang="ts">
import {
  announcerCapability,
  messageActionsActive,
  messageActionsConnect,
  messageActionsMachine,
  messageActionsMessages,
} from "@rind-ui/core"
import { normalizeProps } from "../normalize-props"
import { useEnvironment, useLocale, useMessages } from "../provider"
import ToolbarRoot from "../toolbar/toolbar-root.svelte"
import { useMachine } from "../use-machine.svelte"
import { messageActionsContext } from "./context"
import type { MessageActionsRenderState, MessageActionsRootProps } from "./types"

let {
  active,
  onRegenerate,
  editing = $bindable(),
  defaultEditing,
  onEditingChange,
  count,
  index = $bindable(),
  defaultIndex,
  onIndexChange,
  loop,
  messages: ownMessages,
  locale: ownLocale,
  host,
  id,
  children,
  ...rest
}: MessageActionsRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const env = useEnvironment(announcerCapability)
const messages = useMessages("message-actions", messageActionsMessages, () => ownMessages)
const locale = useLocale(() => ownLocale)
const editEl: { current: HTMLElement | null } = { current: null }
const machine = useMachine(
  messageActionsMachine,
  () => ({
    active,
    onRegenerate: () => onRegenerate?.(),
    ...(editing === undefined ? {} : { editing }),
    defaultEditing,
    onEditingChange: (e: boolean) => {
      onEditingChange?.(e)
      if (editing !== undefined) editing = e
    },
    count,
    ...(index === undefined ? {} : { index }),
    defaultIndex,
    onIndexChange: (i: number) => {
      onIndexChange?.(i)
      if (index !== undefined) index = i
    },
    loop,
    messages: messages(),
    id: instance,
    lang: locale.current.locale,
  }),
  {
    ...env,
    // After editing ends, the focus comes back to Edit unless it went somewhere on purpose.
    restoreEditFocus: () => {
      const el = editEl.current
      const activeEl = el?.ownerDocument.activeElement
      if (el && (activeEl == null || activeEl === el.ownerDocument.body))
        el.focus({ preventScroll: true })
    },
  },
)
const isActive = $derived(messageActionsActive(machine.view.context, { active }))
const api = $derived(
  messageActionsConnect(
    {
      instance,
      active: isActive,
      editing: machine.view.values.editing === true,
      regenerate: machine.view.context.regenerate,
      count: count ?? 0,
      index: machine.view.values.index ?? 0,
      loop: loop === true,
      messages: messages(),
      named: rest["aria-label"] !== undefined || rest["aria-labelledby"] !== undefined,
    },
    env,
  ),
)
const rowState: MessageActionsRenderState = $derived({
  active: isActive,
  editing: machine.view.values.editing === true,
  regenerate: machine.view.context.regenerate,
  index: machine.view.values.index ?? 0,
  count: count ?? 0,
})
messageActionsContext.set({ api: () => api, send: machine.send, editEl })
/** The message's own hover, focus and touch show the row (design §1). */
const watchHost = (root: HTMLElement) => {
  const found = host?.() ?? root.parentElement
  if (!found) return
  // Elements dispatch the HTMLElement events listened to here (SVG ones included).
  const el = found as HTMLElement
  const offs: (() => void)[] = []
  const on = <K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (e: HTMLElementEventMap[K]) => void,
  ) => {
    el.addEventListener(type, listener, { passive: true })
    offs.push(() => el.removeEventListener(type, listener))
  }
  on("pointerenter", () => machine.send({ type: "POINTER.ENTER" }))
  on("pointerleave", () => machine.send({ type: "POINTER.LEAVE" }))
  on("focusin", () => machine.send({ type: "FOCUS.IN" }))
  // Out of the message only: a move between its own elements stays inside.
  on("focusout", (e) => {
    if (!(e.relatedTarget instanceof Node && el.contains(e.relatedTarget)))
      machine.send({ type: "FOCUS.OUT" })
  })
  on("touchstart", () => machine.send({ type: "TOUCH" }))
  return () => {
    for (const off of offs) off()
  }
}
</script>

<ToolbarRoot {...rest} {...normalizeProps(api.root())} id={instance} {loop}>
  {#snippet child({ props })}
    <div {...props} {@attach watchHost}>{@render children?.(rowState)}</div>
  {/snippet}
</ToolbarRoot>
