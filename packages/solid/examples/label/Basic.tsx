/** @jsxImportSource solid-js */
import { Label } from "@rind-ui/solid"

export function Basic() {
  return (
    <div class="stack">
      <Label for="example-name">Name</Label>
      <input id="example-name" class="native" placeholder="Click the label" />
    </div>
  )
}
