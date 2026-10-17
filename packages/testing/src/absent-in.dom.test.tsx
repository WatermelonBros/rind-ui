// The runner and `absentIn` (a contract's states where the component is unmounted): a
// component that disappears when closed walks clean with it, and fails the anchor invariant
// without it — so contracts that do not declare it behave exactly as before.
import { contract, setup, type } from "@rind-ui/core"
import { render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it } from "vitest"
import { testMachine } from "./model"

const noticeMachine = setup({
  types: type<{ props: object; events: { readonly type: "CLOSE" }; env: object }>(),
}).machine({
  id: "notice",
  initial: "open",
  states: { open: { on: { CLOSE: "closed" } }, closed: {} },
})

/** Renders nothing once closed, like a dismissed Alert or an expired Toast. */
function Notice() {
  const [open, setOpen] = useState(true)
  return (
    <div>
      {open && (
        <div data-scope="notice" data-part="root" data-instance="n" data-state="open">
          <span data-scope="notice" data-part="title" data-instance="n">
            Saved
          </span>
          <button
            type="button"
            data-scope="notice"
            data-part="close"
            data-instance="n"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      )}
      <button type="button">Next</button>
    </div>
  )
}

const base = contract("notice", {
  machine: noticeMachine,
  anatomy: ["root", "title", "close"],
  locate: () => ({ text: "Saved" }),
  actions: {
    close: {
      pointer: (env) => env.part("close").click(),
      keyboard: (env) => env.part("close").press("Enter"),
      done: async () => true,
    },
  },
  queries: { isOpen: async (env) => (await env.part("root").attr("data-state")) === "open" },
  states: { open: { isOpen: true }, closed: { isOpen: false } },
  events: { CLOSE: "close" },
  traits: [],
})

async function run(c: typeof base) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(c, {
    test: (name, fn) => tests.push({ name, fn }),
    setup: () => render(<Notice />),
    target: () => screen,
    anchor: [],
    modalities: ["pointer"],
  })
  const errors: string[] = []
  for (const t of tests) {
    await t.fn().catch((e: Error) => errors.push(e.message))
    document.body.innerHTML = ""
  }
  return { count: tests.length, errors }
}

describe("absentIn", () => {
  it("a component unmounted in a declared state walks clean", async () => {
    const { count, errors } = await run({ ...base, absentIn: ["closed"] })
    expect(count).toBeGreaterThan(0)
    expect(errors).toEqual([])
  })

  it("without absentIn the same component fails as before", async () => {
    const { errors } = await run(base)
    expect(errors.join("\n")).toMatch(/no element matches the anchor|must match the anchor/)
  })

  it("a component still mounted in an absent state fails the anchor invariant", async () => {
    const tests: { name: string; fn: () => Promise<void> }[] = []
    testMachine(
      { ...base, absentIn: ["open"] },
      {
        test: (name, fn) => tests.push({ name, fn }),
        setup: () => render(<Notice />),
        target: () => screen,
        anchor: [],
        modalities: ["pointer"],
      },
    )
    const errors: string[] = []
    for (const t of tests) {
      await t.fn().catch((e: Error) => errors.push(e.message))
      document.body.innerHTML = ""
    }
    expect(errors.join("\n")).toMatch(/no element may match the anchor in open \(absentIn\)/)
  })

  it("a state name typo is a compile error", () => {
    contract("notice", {
      machine: noticeMachine,
      anatomy: ["root"],
      locate: () => ({ part: "root" }),
      actions: {},
      queries: {},
      states: { open: {}, closed: {} },
      events: {},
      traits: [],
      // @ts-expect-error "close" is not a state of the machine
      absentIn: ["close"],
    })
  })
})
