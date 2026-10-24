/** @jsxImportSource solid-js */
import { Alert } from "../../src/alert"

export function App() {
  return (
    <Alert.Root>
      <Alert.Title>Couldn't save</Alert.Title>
      <Alert.Description>Disk full</Alert.Description>
      <Alert.CloseTrigger>Dismiss</Alert.CloseTrigger>
    </Alert.Root>
  )
}
