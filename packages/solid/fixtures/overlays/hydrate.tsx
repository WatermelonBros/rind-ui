/** @jsxImportSource solid-js */
import { Dialog } from "../../src/dialog"
import { Popover } from "../../src/popover"

export function App() {
  return (
    <div>
      <Popover.Root>
        <Popover.Trigger>Filters</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Content>
              <Popover.Title>Filters</Popover.Title>
              <Popover.CloseTrigger>Done</Popover.CloseTrigger>
            </Popover.Content>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <Dialog.Root>
        <Dialog.Trigger>Edit profile</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Title>Edit profile</Dialog.Title>
              <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
