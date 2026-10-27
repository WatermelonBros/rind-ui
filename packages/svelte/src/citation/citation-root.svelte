<script lang="ts">
import {
  citationConnect,
  citationMachine,
  citationMessages,
  type HoverCardChangeDetails,
} from "@rind-ui/core"
import HoverCardRoot from "../hover-card/hover-card-root.svelte"
import { useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { citationContext } from "./context"
import type { CitationRenderState, CitationRootProps } from "./types"

const {
  source,
  index,
  target = "_self",
  openDelay = 300,
  closeDelay = 200,
  onPinnedChange,
  messages: ownMessages,
  id,
  children,
}: CitationRootProps = $props()

const uid = $props.id()
const instance = $derived(id ?? uid)
const messages = useMessages("citation", citationMessages, () => ownMessages)
let hoverOpen = $state(false)
const connect = (open: boolean, pinned: boolean) =>
  citationConnect({ instance, index, source, open, pinned, target, messages: messages() })
const machine = useMachine(
  citationMachine,
  () => ({
    kind: connect(false, false).kind === "link" ? ("link" as const) : ("button" as const),
    onPinnedChange: (p: boolean) => onPinnedChange?.(p),
  }),
  {},
)
const pinned = $derived(machine.view.state === "pinned")
const api = $derived(connect(hoverOpen, pinned))
const open = $derived(source !== undefined && (pinned || hoverOpen))
const citationState: CitationRenderState = $derived({ open, pinned, kind: api.kind })
citationContext.set({
  api: () => api,
  state: () => citationState,
  source: () => source,
  press: () => machine.send({ type: "PRESS" }),
})
const CLOSES = new Set(["escape-key", "outside-press", "outside-focus", "parent-dismissed"])
const onOpenChange = (next: boolean, details: HoverCardChangeDetails) => {
  hoverOpen = next
  // Escape, an outside press or a dismissal closes a pinned card too.
  if (!next && CLOSES.has(details.reason)) machine.send({ type: "UNPIN" })
}
</script>

<HoverCardRoot
  id={instance}
  {open}
  {openDelay}
  {closeDelay}
  disabled={source === undefined}
  {onOpenChange}
>{@render children?.()}</HoverCardRoot>
