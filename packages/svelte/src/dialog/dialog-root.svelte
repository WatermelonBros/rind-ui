<script lang="ts">
import { dialogMachine, dialogMessages } from "@rind-ui/core"
import { untrack } from "svelte"
import { useMessages } from "../provider"
import { isOpen, useDialogRoot } from "./context.svelte"
import type { DialogRootProps } from "./types"

let {
  role = "dialog",
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
  children,
}: DialogRootProps = $props()
const uid = $props.id()
const messages = useMessages("dialog", dialogMessages, () => ownMessages)
const dialog = useDialogRoot(
  { scope: "dialog", kind: "dialog", machine: dialogMachine },
  {
    role: () => role ?? "dialog",
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
    messages,
  },
)
untrack(() => {
  actions = dialog.actions
})
</script>

{@render children?.({ open: isOpen(dialog.host) })}
