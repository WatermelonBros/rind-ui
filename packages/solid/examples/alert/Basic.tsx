/** @jsxImportSource solid-js */
import { Alert } from "@rind-ui/solid"

export function Basic() {
  // Present when the page loads, and static: `announce="off"`.
  return (
    <Alert.Root announce="off">
      <Alert.Icon>ℹ</Alert.Icon>
      <Alert.Title>Maintenance tonight</Alert.Title>
      <Alert.Description>Saving is paused from 22:00 to 22:30.</Alert.Description>
    </Alert.Root>
  )
}
