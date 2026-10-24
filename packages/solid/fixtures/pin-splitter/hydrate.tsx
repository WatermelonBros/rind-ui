/** @jsxImportSource solid-js */
import { PinInput } from "../../src/pin-input"
import { Splitter } from "../../src/splitter"

export function App() {
  return (
    <form>
      <PinInput.Root length={4} name="code" defaultValue="12">
        <PinInput.Label>Code</PinInput.Label>
        <PinInput.Control>
          <PinInput.Input />
          <PinInput.Slot index={0} />
          <PinInput.Slot index={1} />
          <PinInput.Slot index={2} />
          <PinInput.Slot index={3} />
        </PinInput.Control>
      </PinInput.Root>
      <Splitter.Root panels={[{ min: 10 }, { min: 10 }]} defaultSizes={[30, 70]}>
        <Splitter.Panel index={0}>One</Splitter.Panel>
        <Splitter.Handle index={0} aria-label="One" />
        <Splitter.Panel index={1}>Two</Splitter.Panel>
      </Splitter.Root>
    </form>
  )
}
