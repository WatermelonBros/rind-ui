// Broken Pin Input variants (task 6.2): a variant with a focusable input in each slot fails
// the first step naming the one-textbox invariant; the correct component passes the run.
import { pinInputContract, pinInputMessages } from "@rind-ui/core"
import { PinInput, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { domEnv, testMachine } from "../index"

const props = {
  length: 4,
  validationType: undefined,
  pattern: undefined,
  sanitize: undefined,
  value: undefined,
  defaultValue: "12",
  onValueChange: undefined,
  onValueInvalid: undefined,
  onValueComplete: undefined,
  autoSubmit: undefined,
  disabled: undefined,
  readOnly: undefined,
  messages: pinInputMessages,
  id: "pin",
  writeCaret: () => {},
  resync: () => {},
  requestSubmit: undefined,
}

function Code({ perSlotInputs = false }: { readonly perSlotInputs?: boolean }) {
  return (
    <RindProvider>
      <PinInput.Root length={4} defaultValue="12">
        <PinInput.Label>Verification code</PinInput.Label>
        <PinInput.Control>
          <PinInput.Input />
          {[0, 1, 2, 3].map((i) => (
            <span key={i}>
              <PinInput.Slot index={i} />
              {/* The per-slot design: a focusable input at each position. */}
              {perSlotInputs ? <input aria-label={`Digit ${i + 1}`} /> : null}
            </span>
          ))}
        </PinInput.Control>
        <button type="reset">Reset</button>
      </PinInput.Root>
    </RindProvider>
  )
}

async function failuresOf(story: () => React.ReactElement) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(pinInputContract, {
    test: (name: string, fn: () => Promise<void>) => tests.push({ name, fn }),
    setup: () => render(story()),
    target: () => domEnv({ timeout: 300 }),
    anchor: [{ name: "Verification code" }],
    props: props as never,
    modalities: ["keyboard"],
  } as never)
  const out: (string | null)[] = []
  for (const t of tests) {
    out.push(
      await t.fn().then(
        () => null,
        (e: Error) => e.message,
      ),
    )
    document.body.innerHTML = ""
  }
  return out
}

describe("pin-input broken variants fail readably", () => {
  it("the correct component passes", { timeout: 60_000 }, async () => {
    expect((await failuresOf(() => <Code />)).filter(Boolean)).toEqual([])
  })

  it("a focusable input in each slot", { timeout: 60_000 }, async () => {
    const errors = await failuresOf(() => <Code perSlotInputs />)
    expect(errors.filter((e) => e?.includes("pin-input-one-textbox")).length).toBeGreaterThan(0)
  })
})
