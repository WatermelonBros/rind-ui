// The oracle receives each step's modality (a11y-invariants "Modality-Aware Oracle").
import {
  contract,
  domEnvironment,
  focusAttrs,
  isKeyboardOrVirtual,
  type PressEvent,
  scopeAttrs,
  setup,
  type,
} from "@rind-ui/core"
import { useModality, usePress } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { useEffect, useMemo, useState } from "react"
import { describe, expect, it } from "vitest"
import { testMachine } from "./index"

// A menu trigger: a keyboard or AT press opens and focuses the first item; a pointer press
// only opens.
const menu = setup({
  types: type<{ props: object; events: PressEvent; env: object }>(),
  guards: { isKeyboardOrVirtual },
}).machine({
  id: "menu",
  initial: "closed",
  states: {
    closed: {
      on: { PRESS: [{ target: "focusFirst", guard: "isKeyboardOrVirtual" }, { target: "open" }] },
    },
    open: {},
    focusFirst: {},
  },
})

const menuContract = contract("menu", {
  machine: menu,
  anatomy: ["trigger"],
  locate: (name: string) => ({ role: "button", name }),
  queries: { state: async (env) => (await env.part("trigger").attr("data-state")) ?? "" },
  actions: {
    open: {
      pointer: (env) => env.part("trigger").click(),
      keyboard: (env) => env.part("trigger").press("Enter"),
      done: async () => true,
    },
  },
  states: { closed: { state: "closed" }, open: { state: "open" }, focusFirst: { state: "first" } },
  events: {
    PRESS: "open",
    "PRESS.START": { skip: "part of every press" },
    "PRESS.UP": { skip: "part of every press" },
    "PRESS.END": { skip: "part of every press" },
    "PRESS.CANCEL": { skip: "no state change" },
  },
  traits: [],
})

function Trigger() {
  const env = useMemo(() => domEnvironment(), [])
  useEffect(() => env.modality.subscribe(() => {}), [env])
  const [state, setState] = useState("closed")
  const [focused, setFocused] = useState(false)
  const modality = useModality(env.modality, focused)
  const press = usePress({
    env,
    send: (e) => {
      if (e.type !== "PRESS" || state !== "closed") return
      setState(e.modality === "keyboard" || e.modality === "virtual" ? "first" : "open")
    },
  })
  return (
    <button
      type="button"
      {...scopeAttrs("menu", "trigger", "m1")}
      data-state={state}
      {...press.props}
      {...focusAttrs(focused, modality)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      Actions
    </button>
  )
}

describe("modality-aware oracle", () => {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(menuContract, {
    test: (name, fn) => tests.push({ name, fn }),
    setup: () => render(<Trigger />),
    target: () => screen,
    anchor: ["Actions"],
    props: {},
  })

  it("a virtual press reaches the keyboard state; a pointer press does not", async () => {
    const byModality = (m: string) => tests.filter((t) => t.name.includes(`[${m}]`))
    expect(byModality("virtual").length).toBeGreaterThan(0)
    for (const t of tests) {
      await t.fn()
      document.body.innerHTML = ""
    }
  })
})

describe("planning with the modality (review round 1)", () => {
  it("a guard on the modality is planned per modality: the keyboard branch is walked, nothing unreachable", () => {
    const names: string[] = []
    testMachine(menuContract, {
      test: (name) => names.push(name),
      setup: () => render(<Trigger />),
      target: () => screen,
      anchor: ["Actions"],
      props: {},
    })
    expect(names).toContain("menu [keyboard]: closed —PRESS[isKeyboardOrVirtual]→ focusFirst")
    expect(names).toContain("menu [virtual]: closed —PRESS[isKeyboardOrVirtual]→ focusFirst")
    expect(names).toContain("menu [pointer]: closed —PRESS→ open")
    expect(names.filter((n) => n.includes("coverage"))).toEqual([])
  })
})
