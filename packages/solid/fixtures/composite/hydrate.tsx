/** @jsxImportSource solid-js */
import { Accordion } from "../../src/accordion"
import { Collapsible } from "../../src/collapsible"
import { RadioGroup } from "../../src/radio-group"
import { SegmentedControl } from "../../src/segmented-control"
import { Switch } from "../../src/switch"
import { Tabs } from "../../src/tabs"

export function App() {
  return (
    <div>
      <Tabs.Root defaultValue="b">
        <Tabs.List aria-label="Settings">
          <Tabs.Tab value="a">A</Tabs.Tab>
          <Tabs.Tab value="b">B</Tabs.Tab>
          <Tabs.Indicator />
        </Tabs.List>
        <Tabs.Panel value="a">Panel A</Tabs.Panel>
        <Tabs.Panel value="b">Panel B</Tabs.Panel>
      </Tabs.Root>
      <RadioGroup.Root defaultValue="m" name="size">
        <RadioGroup.Label>Size</RadioGroup.Label>
        <RadioGroup.Item value="s">
          <RadioGroup.ItemControl>
            <RadioGroup.ItemIndicator />
          </RadioGroup.ItemControl>
          <RadioGroup.ItemLabel>Small</RadioGroup.ItemLabel>
        </RadioGroup.Item>
        <RadioGroup.Item value="m">
          <RadioGroup.ItemControl>
            <RadioGroup.ItemIndicator />
          </RadioGroup.ItemControl>
          <RadioGroup.ItemLabel>Medium</RadioGroup.ItemLabel>
        </RadioGroup.Item>
      </RadioGroup.Root>
      <SegmentedControl.Root aria-label="Range" defaultValue="week">
        <SegmentedControl.Item value="day">Day</SegmentedControl.Item>
        <SegmentedControl.Item value="week">Week</SegmentedControl.Item>
        <SegmentedControl.Indicator />
      </SegmentedControl.Root>
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>More</Collapsible.Trigger>
        <Collapsible.Content>Body</Collapsible.Content>
      </Collapsible.Root>
      <Accordion.Root defaultValue={["x"]}>
        <Accordion.Item value="x">
          <Accordion.Header>
            <Accordion.Trigger>X</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Xs</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="y">
          <Accordion.Header>
            <Accordion.Trigger>Y</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>Ys</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
      <Switch.Root name="wifi" defaultChecked>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Label>Wi-Fi</Switch.Label>
      </Switch.Root>
    </div>
  )
}
