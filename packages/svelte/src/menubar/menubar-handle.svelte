<script lang="ts">
// Registers the menu level's service with the bar (the port's handle).
import { menuLevel } from "../menu/context.svelte"
import { type MenuHandle, menubar, menubarEntry } from "./context"

const bar = menubar.get()
const entry = menubarEntry.get()
const level = menuLevel.get()
const service = level.service
const handle: MenuHandle = {
  isOpen: () => service.getSnapshot().state === "open",
  // Sound: every event the port sends is a menu event.
  send: (event: unknown) => service.send(event as Parameters<typeof service.send>[0]),
}
$effect(() => {
  const key = entry.key()
  bar.handles.set(key, handle)
  return () => {
    if (bar.handles.get(key) === handle) bar.handles.delete(key)
  }
})
</script>
