<script lang="ts">
import {
  type ChangeDetails,
  type DrawerEvent,
  dialogMachine,
  dialogMessages,
  drawerMachine,
  drawerMessages,
  type SnapPoint,
} from "@rind-ui/core"
import { untrack } from "svelte"
import { isOpen, useDialogRoot } from "../dialog/context.svelte"
import { useLocale, useMessages } from "../provider"
import { drawerSettings } from "./context"
import type { DrawerRootProps } from "./types"

let {
  open = $bindable(),
  defaultOpen,
  onOpenChange,
  modal,
  closeOnEscape,
  closeOnInteractOutside,
  initialFocus,
  finalFocus,
  onEscapeKeyDown,
  onInteractOutside,
  id,
  keepMounted = false,
  messages: ownMessages,
  actions = $bindable(),
  side,
  swipeThreshold,
  swipeVelocityThreshold,
  closeOnSwipe,
  snapPoints,
  snapPoint = $bindable(),
  defaultSnapPoint,
  onSnapPointChange,
  snapToSequentialPoints,
  children,
}: DrawerRootProps = $props()
const uid = $props.id()
const messages = useMessages("drawer", drawerMessages, () => ownMessages)
// The Dialog's messages, its close label the drawer's.
const strings = useMessages("dialog", dialogMessages, () => ({ close: messages().close }))
const locale = useLocale(() => undefined)
drawerSettings.set({
  messages,
  side: () => side,
  dir: () => locale.current.dir,
  snapPoints: () => snapPoints,
})
const drawer = useDialogRoot(
  {
    scope: "drawer",
    kind: "drawer",
    // Sound: the drawer machine is the Dialog's pieces plus its own; every Dialog part reads
    // and sends only the Dialog's context, values and events, which it keeps.
    machine: drawerMachine as unknown as typeof dialogMachine,
  },
  {
    role: () => "dialog",
    open: () => open,
    setOpen: (next) => {
      if (open !== undefined) open = next
    },
    defaultOpen: () => defaultOpen,
    onOpenChange: () => onOpenChange,
    modal: () => modal,
    closeOnEscape: () => closeOnEscape,
    closeOnInteractOutside: () => closeOnInteractOutside,
    initialFocus: () => initialFocus,
    finalFocus: () => finalFocus,
    onEscapeKeyDown: () => onEscapeKeyDown,
    onInteractOutside: () => onInteractOutside,
    id: () => id,
    uid,
    keepMounted: () => keepMounted,
    messages: strings,
    // The drawer's props ride along: the drawer machine reads them.
    extra: () => ({
      side,
      dir: locale.current.dir,
      swipeThreshold,
      swipeVelocityThreshold,
      closeOnSwipe,
      snapPoints,
      snapPoint,
      defaultSnapPoint,
      onSnapPointChange: (next: SnapPoint, details: ChangeDetails<DrawerEvent>) => {
        let cancelled = false
        onSnapPointChange?.(next, {
          ...details,
          cancel: () => {
            cancelled = true
            details.cancel()
          },
        })
        if (!cancelled && snapPoint !== undefined) snapPoint = next
      },
      snapToSequentialPoints,
    }),
  },
)
untrack(() => {
  actions = drawer.actions
})
</script>

{@render children?.({ open: isOpen(drawer.host) })}
