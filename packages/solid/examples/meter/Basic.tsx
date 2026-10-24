/** @jsxImportSource solid-js */
import { Meter } from "@rind-ui/solid"

export function Basic() {
  return (
    <Meter.Root value={75}>
      <Meter.Label>Storage</Meter.Label>
      <Meter.ValueText />
      <Meter.Track>
        <Meter.Indicator />
      </Meter.Track>
    </Meter.Root>
  )
}
