/** @jsxImportSource solid-js */
import { Dialog } from "@rind-ui/solid"

export function Basic() {
  return (
    <Dialog.Root>
      <Dialog.Trigger>Edit profile</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Title>Edit profile</Dialog.Title>
            <Dialog.Description>Change how your name appears to others.</Dialog.Description>
            <label class="stack">
              Display name
              <input value="Ada Lovelace" />
            </label>
            <div class="row">
              <Dialog.CloseTrigger>Cancel</Dialog.CloseTrigger>
              <Dialog.CloseTrigger>Save</Dialog.CloseTrigger>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
