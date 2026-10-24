/** @jsxImportSource solid-js */
import { SegmentedControl } from "@rind-ui/solid"

export function Basic() {
  return (
    <SegmentedControl.Root aria-label="Range" defaultValue="week">
      <SegmentedControl.Item value="day">Day</SegmentedControl.Item>
      <SegmentedControl.Item value="week">Week</SegmentedControl.Item>
      <SegmentedControl.Item value="month">Month</SegmentedControl.Item>
      <SegmentedControl.Indicator />
    </SegmentedControl.Root>
  )
}
