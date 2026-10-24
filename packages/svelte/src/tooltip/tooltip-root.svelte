<script lang="ts">
import {
  domDelayGroup,
  domHoverIntent,
  domPositioning,
  type TooltipChangeDetails,
  type TooltipProps,
  tooltipMachine,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { useParentLayer } from "../layer-context"
import { useEnvironment } from "../provider"
import { useMachine } from "../use-machine.svelte"
import { tooltipHost } from "./context.svelte"
import type { TooltipRootProps } from "./types"

let {
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  openDelay,
  closeDelay,
  skipDelay,
  closeOnPress,
  disabled,
  positioning,
  id,
  type = "description",
  actions = $bindable(),
  children,
}: TooltipRootProps = $props()
const uid = $props.id()
const root = $derived(id ?? uid)
const parent = useParentLayer()
const env = useEnvironment()
// Positioning, hover intent and the delay group only for components that use them.
const tooltipEnv = {
  ...env,
  position: domPositioning(env),
  hoverIntent: domHoverIntent(env),
  delayGroup: domDelayGroup(env),
}
// The trigger by reference: a rind-ui part used as the trigger keeps its own id.
const shared = $state({ trigger: null as HTMLElement | null, contentMounted: false })
const machineProps = (): TooltipProps => ({
  open,
  defaultOpen,
  onOpenChange: (next: boolean, details: TooltipChangeDetails) => {
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
  skipDelay,
  closeOnPress,
  disabled,
  positioning,
  root,
  parent: parent(),
  getTrigger: () => shared.trigger,
})
const machine = useMachine(tooltipMachine, machineProps, tooltipEnv)
untrack(() => {
  actions = {
    open: () => machine.send({ type: "OPEN" }),
    close: () => machine.send({ type: "CLOSE" }),
  }
})
tooltipHost.set({
  service: machine.service,
  view: () => machine.view,
  root: () => root,
  props: machineProps,
  type: () => type,
  hoverIntent: tooltipEnv.hoverIntent,
  shared,
})
</script>

{@render children?.({ open: machine.view.values.open })}
