// Broken Search Field variants (task 5.2): each must fail the model with a readable report
// naming the invariant it breaks; the correct component passes the same run.
import { textFieldContract, textFieldMessages } from "@rind-ui/core"
import { RindProvider, TextField } from "@rind-ui/react"
import { render } from "@testing-library/react"
import type { KeyboardEvent } from "react"
import { describe, expect, it } from "vitest"
import { domEnv, installAnnouncementLog, testMachine, textFieldKeyStepInvariants } from "../index"

const base = {
  messages: textFieldMessages,
  id: "sf",
  clearInput: () => {},
  onSubmit: undefined,
  disabled: undefined,
  readOnly: undefined,
  focusableWhenDisabled: undefined,
  limit: undefined,
  threshold: undefined,
  count: undefined,
  value: undefined,
  onValueChange: undefined,
}

let submits = 0
const keys = textFieldKeyStepInvariants({ submits: () => submits })

function Frame(props: {
  readonly defaultValue: string
  readonly onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <RindProvider>
      <TextField.Root
        type="search"
        defaultValue={props.defaultValue}
        onSubmit={() => {
          submits += 1
        }}
      >
        <TextField.Label>Search books</TextField.Label>
        <TextField.Input {...(props.onKeyDown ? { onKeyDown: props.onKeyDown } : {})} />
      </TextField.Root>
    </RindProvider>
  )
}

// Typing is the model test's (it re-expresses keyboard typing for the IME replay).
const untyped = {
  ...textFieldContract,
  events: { ...textFieldContract.events, INPUT: { skip: "covered by the model test" } },
} as typeof textFieldContract

async function failuresOf(story: () => React.ReactElement, defaultValue: string) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  let stop = () => {}
  testMachine(untyped, {
    test: (name: string, fn: () => Promise<void>) => tests.push({ name, fn }),
    setup: () => {
      stop()
      stop = keys.reset()
      submits = 0
      return render(story())
    },
    target: () => domEnv({ timeout: 300 }),
    anchor: [{ name: "Search books" }],
    props: { ...base, defaultValue } as never,
    invariants: keys.invariants,
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
    installAnnouncementLog().length = 0
  }
  stop()
  return out
}
const named = (errors: (string | null)[], invariant: string) =>
  errors.filter((e) => e?.includes(invariant))

describe("text-field search broken variants fail readably", () => {
  it("the correct component passes, empty and not", { timeout: 60_000 }, async () => {
    for (const v of ["", "abc"]) {
      const errors = await failuresOf(() => <Frame defaultValue={v} />, v)
      expect(errors.filter(Boolean)).toEqual([])
    }
  })

  it("Escape always consumed (react-spectrum#5480)", { timeout: 60_000 }, async () => {
    const errors = await failuresOf(
      () => (
        <Frame
          defaultValue=""
          onKeyDown={(e) => {
            if (e.key === "Escape") e.preventDefault()
          }}
        />
      ),
      "",
    )
    expect(named(errors, "text-field-escape-consumed").length).toBeGreaterThan(0)
  })

  it("Enter not IME-guarded (react-spectrum#6421)", { timeout: 60_000 }, async () => {
    const errors = await failuresOf(
      () => (
        <Frame
          defaultValue="abc"
          onKeyDown={(e) => {
            if (e.key === "Enter") submits += 1
          }}
        />
      ),
      "abc",
    )
    expect(named(errors, "text-field-ime-keys").length).toBeGreaterThan(0)
  })
})
