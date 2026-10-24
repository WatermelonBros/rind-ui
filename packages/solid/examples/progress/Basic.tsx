/** @jsxImportSource solid-js */
import { Progress } from "@rind-ui/solid"

export function Basic() {
  return (
    <Progress.Root value={40}>
      <Progress.Label>Uploading</Progress.Label>
      <Progress.ValueText />
      <Progress.Track>
        <Progress.Indicator />
      </Progress.Track>
    </Progress.Root>
  )
}
