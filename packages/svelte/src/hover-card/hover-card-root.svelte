<script lang="ts">
import {
  domHoverIntent,
  domPositioning,
  getLayerStack,
  type HoverCardChangeDetails,
  type HoverCardProps,
  hoverCardLayerId,
  hoverCardMachine,
  type LayerMeta,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { useParentLayer } from "../layer-context"
import { useEnvironment } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { hoverCardHost } from "./context"
import type { HoverCardRootProps } from "./types"

let {
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  openDelay,
  closeDelay,
  disabled,
  positioning,
  id,
  keepMounted = false,
  actions = $bindable(),
  children,
}: HoverCardRootProps = $props()
const uid = $props.id()
const root = $derived(id ?? uid)
const parent = useParentLayer()
const env = useEnvironment()
const hoverEnv = { ...env, position: domPositioning(env), hoverIntent: domHoverIntent(env) }
const shared = $state({
  trigger: null as HTMLElement | null,
  contentMounted: false,
  meta: undefined as LayerMeta | undefined,
})
const machineProps = (): HoverCardProps => ({
  open,
  defaultOpen,
  onOpenChange: (next: boolean, details: HoverCardChangeDetails) => {
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
  openDelay,
  closeDelay,
  disabled,
  positioning,
  root,
  parent: parent(),
  getTrigger: () => shared.trigger,
})
const machine = useMachine(hoverCardMachine, machineProps, hoverEnv)
untrack(() => {
  actions = {
    open: () => machine.send({ type: "OPEN" }),
    close: () => machine.send({ type: "CLOSE" }),
  }
})
const isOpen = $derived(machine.view.values.open === true)
$effect(() => {
  shared.meta = undefined
  if (!isOpen) return
  const layer = hoverCardLayerId(root)
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
hoverCardHost.set({
  service: machine.service,
  view: () => machine.view,
  root: () => root,
  props: machineProps,
  keepMounted: () => keepMounted,
  hoverIntent: hoverEnv.hoverIntent,
  shared,
})
</script>

{@render children?.({ open: isOpen })}
