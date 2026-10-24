<script lang="ts">
import {
  type ChangeDetails,
  domPositioning,
  getLayerStack,
  type HeadingLevel,
  type LayerMeta,
  type PopoverEvent,
  type PopoverProps,
  popoverLayerId,
  popoverMachine,
  popoverMessages,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { useParentLayer } from "../layer-context"
import { useEnvironment, useMessages } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { popoverHost, type Rendered } from "./context.svelte"
import type { PopoverRootProps } from "./types"

let {
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  modal,
  disabled,
  closeOnEscape,
  closeOnInteractOutside,
  onEscapeKeyDown,
  onInteractOutside,
  persistentElements,
  initialFocus,
  finalFocus,
  positioning,
  id,
  keepMounted = false,
  messages: ownMessages,
  actions = $bindable(),
  scope,
  children,
}: PopoverRootProps = $props()

const uid = $props.id()
const root = $derived(id ?? uid)
const parent = useParentLayer()
const messages = useMessages("popover", popoverMessages, () => ownMessages)
const env = useEnvironment()
// Positioning only for anchored components: not part of domEnvironment().
const withPosition = { ...env, position: domPositioning(env) }
const shared = $state({
  contentMounted: false,
  anchorRendered: false,
  titleLevel: 2 as HeadingLevel,
  rendered: {} as Rendered,
  meta: undefined as LayerMeta | undefined,
})
const machineProps = (): PopoverProps => ({
  open,
  defaultOpen,
  onOpenChange: (next: boolean, details: ChangeDetails<PopoverEvent>) => {
    let cancelled = false
    onOpenChange?.(next, {
      ...details,
      cancel: () => {
        cancelled = true
        details.cancel()
      },
    })
    if (!cancelled && open !== undefined) open = next
  },
  modal,
  disabled,
  closeOnEscape,
  closeOnInteractOutside,
  onEscapeKeyDown,
  onInteractOutside,
  persistentElements,
  initialFocus,
  finalFocus,
  positioning,
  root,
  parent: parent(),
  anchored: shared.anchorRendered,
  scope,
})
const machine = useMachine(popoverMachine, machineProps, withPosition)
untrack(() => {
  actions = {
    open: () => machine.send({ type: "open" }),
    close: () => machine.send({ type: "api", close: true }),
    reposition: () => machine.send({ type: "POSITION.REPOSITION" }),
  }
})
const isOpen = $derived(machine.view.matches("open"))
$effect(() => {
  shared.meta = undefined
  if (!isOpen) return
  const layer = popoverLayerId(root)
  return untrack(() => {
    const node = env.dom.getRootNode()
    const stack = getLayerStack("body" in node ? node : node.ownerDocument)
    const read = () => {
      shared.meta = stack.get(layer)?.meta()
    }
    read()
    return stack.subscribe(read)
  })
})
popoverHost.set({
  service: machine.service,
  view: () => machine.view,
  root: () => root,
  scope: () => scope ?? "popover",
  props: machineProps,
  keepMounted: () => keepMounted,
  messages,
  shared,
})
</script>

{@render children?.({ open: isOpen })}
