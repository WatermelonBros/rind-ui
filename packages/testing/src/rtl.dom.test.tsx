import { contract } from "@rind-ui/core"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { disclosureMachine } from "../fixtures/disclosure"
import { DisclosureExample } from "../fixtures/disclosure/disclosure.fixture"
import { createDriverWith } from "./driver"
import { testMachine } from "./model"

// A directional contract over the fixture: horizontal arrows and Home on the trigger.
const arrows = contract("disclosure", {
  machine: disclosureMachine,
  anatomy: ["root", "trigger", "content"],
  locate: (name: string) => ({ role: "button", name }),
  queries: { dir: async (env) => (await env.part("trigger").attr("aria-expanded")) ?? "" },
  actions: {
    next: { keyboard: (env) => env.part("trigger").press("ArrowRight"), done: async () => true },
    first: { keyboard: (env) => env.part("trigger").press("Home"), done: async () => true },
    up: { keyboard: (env) => env.keyboard("ArrowUp"), done: async () => true },
  },
  states: { open: {}, closed: {} },
  events: {},
  traits: ["directional"],
})

describe("right-to-left runs", () => {
  it("mirror horizontal arrows only", async () => {
    render(<DisclosureExample />)
    const keys: string[] = []
    document.addEventListener("keydown", (e) => keys.push(e.key))
    const rtl = createDriverWith(arrows, screen, ["Details"], { direction: "rtl" })
    await rtl.next()
    await rtl.first()
    await rtl.up()
    const ltr = createDriverWith(arrows, screen, ["Details"])
    await ltr.next()
    expect(keys).toEqual(["ArrowLeft", "Home", "ArrowUp", "ArrowRight"])
  })

  it("directional contracts run in both directions by default", () => {
    const names: string[] = []
    testMachine(
      { ...arrows, events: { TOGGLE: "next" } },
      {
        test: (name) => names.push(name),
        setup: () => null,
        target: () => screen,
        anchor: ["Details"],
      },
    )
    expect(names.some((n) => n.includes("[keyboard, rtl]"))).toBe(true)
    expect(names.some((n) => n.includes("[keyboard]"))).toBe(true)
  })
})
