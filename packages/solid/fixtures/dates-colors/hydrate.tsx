/** @jsxImportSource solid-js */
import { CalendarDate } from "@internationalized/date"
import { Calendar } from "../../src/calendar"
import { ColorPicker } from "../../src/color-picker"
import { DateField } from "../../src/date-field"
import { RindProvider } from "../../src/provider"
import { Tour } from "../../src/tour"

// Fixed, so the server's and the client's "today" agree.
const clock = { now: () => Date.parse("2026-10-17T12:00:00Z"), timeZone: () => "UTC" }
const steps = [{ id: "welcome", title: "Welcome", description: "A short tour." }]

export function App() {
  return (
    <RindProvider environment={{ dateClock: clock }}>
      <div>
        <Tour.Root id="tour" steps={steps}>
          <Tour.Trigger>Take the tour</Tour.Trigger>
          <Tour.Portal>
            <Tour.Backdrop />
            <Tour.Positioner>
              <Tour.Content>
                <Tour.Title />
                <Tour.Description />
                <Tour.CloseTrigger>Close</Tour.CloseTrigger>
              </Tour.Content>
            </Tour.Positioner>
          </Tour.Portal>
        </Tour.Root>
        <Calendar.Root id="cal" aria-label="Departure">
          <Calendar.Header>
            <Calendar.PrevTrigger />
            <Calendar.Heading />
            <Calendar.NextTrigger />
          </Calendar.Header>
          <Calendar.Grid />
        </Calendar.Root>
        <DateField.Root
          id="date"
          locale="en-US"
          name="birthday"
          defaultValue={new CalendarDate(2026, 10, 14)}
        >
          <DateField.Label>Birthday</DateField.Label>
          <DateField.Input />
        </DateField.Root>
        <ColorPicker.Root id="fill" defaultValue="#3D8BFF" name="fill">
          <ColorPicker.Label>Background</ColorPicker.Label>
          <ColorPicker.Control>
            <ColorPicker.Trigger>
              <ColorPicker.ValueSwatch />
            </ColorPicker.Trigger>
            <ColorPicker.ValueText />
          </ColorPicker.Control>
          <ColorPicker.Portal>
            <ColorPicker.Positioner>
              <ColorPicker.Content>
                <ColorPicker.ChannelInput channel="hex" />
              </ColorPicker.Content>
            </ColorPicker.Positioner>
          </ColorPicker.Portal>
        </ColorPicker.Root>
      </div>
    </RindProvider>
  )
}
