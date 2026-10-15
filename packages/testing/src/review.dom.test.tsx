// Regression tests for the add-foundations review: adapter parity, polling, coverage.
import { contract } from "@rind-ui/core"
import { render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { disclosureContract, disclosureMachine } from "../fixtures/disclosure"
import { createDriver, createDriverWith, domEnv, testMachine } from "./index"

const A = { "data-scope": "disclosure", "data-instance": "a" }

/** Opens 60 ms after the click: a deferred React update during polling. */
function Slow() {
  const [open, setOpen] = useState(false)
  return (
    <div {...A} data-part="root">
      <button
        type="button"
        {...A}
        data-part="trigger"
        aria-expanded={open}
        onClick={() => setTimeout(() => setOpen(!open), 60)}
      >
        Details
      </button>
      <div {...A} data-part="content" hidden={!open}>
        Body
      </div>
    </div>
  )
}

describe("DOM adapter", () => {
  it("polls inside asyncWrapper: deferred updates log no act() warning", async () => {
    const errors = vi.spyOn(console, "error")
    render(<Slow />)
    await createDriver(disclosureContract, screen, "Details").open()
    expect(errors.mock.calls.filter((c) => String(c[0]).includes("act("))).toEqual([])
    errors.mockRestore()
  })

  it("a postcondition reading a missing part fails near the timeout, not a multiple of it", async () => {
    render(<Slow />)
    const missing = contract("disclosure", {
      ...disclosureContract,
      actions: {
        ...disclosureContract.actions,
        open: {
          ...disclosureContract.actions.open,
          done: async (env) => (await env.part("content", { text: "never" }).attr("x")) === "y",
        },
      },
    })
    const start = Date.now()
    const error = await createDriver(missing, domEnv({ timeout: 100 }), "Details")
      .open()
      .catch((e: Error) => e.message)
    expect(String(error)).toMatch(/disclosure\.open \[pointer\]/)
    expect(Date.now() - start).toBeLessThan(800)
  })

  it("text anchors match the deepest element only", async () => {
    document.body.innerHTML =
      '<div data-scope="t" data-instance="a" data-part="root"><p><span>Details</span></p></div>'
    const env = domEnv().create({ scope: "t", anchor: { text: "Details" }, modality: "pointer" })
    expect(await env.anchorCount()).toBe(1)
    expect(await env.instance()).toBe("a")
    document.body.innerHTML = ""
  })

  it("focused() never returns <body>", async () => {
    document.body.innerHTML = "<button>x</button>"
    const env = domEnv().create({ scope: "t", anchor: { text: "x" }, modality: "pointer" })
    expect(await env.focused().count()).toBe(0)
    document.body.innerHTML = ""
  })

  it("exists() follows the shared visibility rule", async () => {
    document.body.innerHTML =
      '<div style="display:contents" id="dc">c</div><div hidden="until-found" id="uf">u</div>'
    const env = domEnv().create({ scope: "t", anchor: { text: "c" }, modality: "pointer" })
    expect(await env.find({ text: "c" }).exists()).toBe(true)
    expect(await env.find({ text: "u" }).exists()).toBe(false)
    document.body.innerHTML = ""
  })

  it("tap is touch only: no mouse pointer before it", async () => {
    document.body.innerHTML = '<button id="b">x</button>'
    const events: string[] = []
    // Only what the adapter dispatches: the browser itself sends a trusted mouse pointerover when
    // the new button lands under the real cursor left by an earlier test.
    const record = (e: Event) => {
      if (!e.isTrusted) events.push(`${e.type}:${(e as PointerEvent).pointerType ?? ""}`)
    }
    for (const t of ["pointerover", "pointerdown", "mousedown"]) {
      document.addEventListener(t, record, true)
    }
    const env = domEnv().create({
      scope: "s",
      anchor: { role: "button", name: "x" },
      modality: "touch",
    })
    await env.find({ role: "button", name: "x" }).tap()
    expect(events.some((e) => e.endsWith(":mouse"))).toBe(false)
    for (const t of ["pointerover", "pointerdown", "mousedown"]) {
      document.removeEventListener(t, record, true)
    }
    document.body.innerHTML = ""
  })

  it("successive hovers use distinct coordinates", async () => {
    document.body.innerHTML = "<button>a</button><button>b</button>"
    const xs: number[] = []
    const record = (e: Event) => xs.push((e as PointerEvent).clientX)
    document.addEventListener("pointermove", record, true)
    const env = domEnv().create({
      scope: "s",
      anchor: { role: "button", name: "a" },
      modality: "pointer",
    })
    await env.find({ role: "button", name: "a" }).hover()
    await env.find({ role: "button", name: "b" }).hover()
    document.removeEventListener("pointermove", record, true)
    expect(new Set(xs).size).toBeGreaterThan(1)
    document.body.innerHTML = ""
  })
})

describe("testMachine coverage and props", () => {
  const collect = (c: typeof disclosureContract, props?: Record<string, unknown>) => {
    const tests: { name: string; fn: () => Promise<void> }[] = []
    testMachine(c, {
      test: (name, fn) => tests.push({ name, fn }),
      setup: () => null,
      target: () => screen,
      anchor: ["Details"],
      ...(props ? { props } : {}),
    })
    return tests
  }

  it("an unmapped event fails the coverage test", async () => {
    const { ESCAPE: _, ...events } = disclosureContract.events
    const tests = collect(contract("disclosure", { ...disclosureContract, events }), {
      closeOnEscape: undefined,
      autoCloseMs: undefined,
    })
    const coverage = tests.find((t) => t.name.includes("coverage"))
    await expect(coverage?.fn()).rejects.toThrow(/ESCAPE.*no mapping/)
  })

  it("a skipped event is reported with its reason, not failed", async () => {
    const tests = collect(
      contract("disclosure", {
        ...disclosureContract,
        events: { ...disclosureContract.events, ESCAPE: { skip: "tested elsewhere" } },
      }),
      { closeOnEscape: undefined, autoCloseMs: undefined },
    )
    const coverage = tests.find((t) => t.name.includes("coverage"))
    await expect(coverage?.fn()).resolves.toBeUndefined()
  })

  it("reported coverage items are logged even when the coverage test passes (B4)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {})
    const tests = collect(
      contract("disclosure", {
        ...disclosureContract,
        events: { ...disclosureContract.events, ESCAPE: { skip: "tested elsewhere" } },
      }),
      { closeOnEscape: undefined, autoCloseMs: undefined },
    )
    await tests.find((t) => t.name.includes("coverage"))?.fn()
    expect(info).toHaveBeenCalledWith(expect.stringContaining("skipped: tested elsewhere"))
    info.mockRestore()
  })

  it("a guard reading a prop not passed in props fails with the prop's name", async () => {
    const tests = collect(disclosureContract)
    const check = tests.find((t) => t.name.includes("props read by guards"))
    await expect(check?.fn()).rejects.toThrow(/guard reads prop "closeOnEscape"/)
  })
})

describe("right-to-left runs reach the component mirrored", () => {
  const D = { "data-scope": "dir", "data-instance": "a" }
  // Opens on the logical "forward" key: ArrowRight in ltr, ArrowLeft in rtl.
  function Dir() {
    const [open, setOpen] = useState(false)
    // Only keyboard steps run here, so focus is always keyboard focus (rule 12).
    const [focused, setFocused] = useState(false)
    return (
      <div {...D} data-part="root">
        <button
          type="button"
          {...D}
          data-part="trigger"
          aria-expanded={open}
          data-focus-visible={focused ? "" : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            const forward = document.documentElement.dir === "rtl" ? "ArrowLeft" : "ArrowRight"
            if (e.key === forward) setOpen(true)
          }}
        >
          Details
        </button>
      </div>
    )
  }
  const dir = contract("dir", {
    machine: disclosureMachine,
    anatomy: ["root", "trigger"],
    locate: (name: string) => ({ role: "button", name }),
    queries: {
      isOpen: async (env) => (await env.part("trigger").attr("aria-expanded")) === "true",
    },
    actions: {
      forward: {
        keyboard: (env) => env.part("trigger").press("ArrowRight"),
        done: { isOpen: true },
      },
    },
    states: { open: { isOpen: true }, closed: { isOpen: false } },
    events: {
      OPEN: "forward",
      CLOSE: { skip: "not part of this test" },
      TOGGLE: { skip: "not part of this test" },
      ESCAPE: { skip: "not part of this test" },
    },
    traits: ["directional"],
  })
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(dir, {
    test: (name, fn) => tests.push({ name, fn }),
    setup: () => render(<Dir />),
    target: () => screen,
    anchor: ["Details"],
    props: { closeOnEscape: undefined, autoCloseMs: undefined },
  })

  it("passes in both directions", async () => {
    const runs = tests.filter((t) => t.name.includes("[keyboard"))
    expect(runs.map((t) => t.name.includes("rtl"))).toContain(true)
    for (const t of runs) {
      await t.fn()
      document.body.innerHTML = ""
    }
  })

  it("the driver mirrors horizontal arrows only", async () => {
    render(<Dir />)
    const keys: string[] = []
    const record = (e: KeyboardEvent) => keys.push(e.key)
    document.addEventListener("keydown", record)
    const rtl = createDriverWith(dir, screen, ["Details"], { direction: "rtl" })
    await rtl.env.part("trigger").press("Home")
    await rtl.forward().catch(() => {})
    document.removeEventListener("keydown", record)
    expect(keys).toEqual(["Home", "ArrowLeft"])
  })
})
