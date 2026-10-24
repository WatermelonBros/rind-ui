/** @jsxImportSource solid-js */
import { Separator } from "@rind-ui/solid"

export function Basic() {
  return (
    <div class="stack">
      <p>Account</p>
      <Separator.Root />
      <p>Billing</p>
      <Separator.Root />
      <p>Team</p>
    </div>
  )
}
