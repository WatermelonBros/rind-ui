/** @jsxImportSource solid-js */
import { Badge } from "@rind-ui/solid"

export function Basic() {
  return (
    <div class="row">
      <span>
        Search <Badge.Root>Beta</Badge.Root>
      </span>
      <Badge.Root data-variant="solid">New</Badge.Root>
      <Badge.Root data-variant="outline">Draft</Badge.Root>
    </div>
  )
}
