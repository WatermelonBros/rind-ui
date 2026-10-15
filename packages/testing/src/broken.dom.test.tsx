// One deliberately broken component per accessibility invariant (add-a11y-foundations 9.10):
// each must fail testMachine with a report naming the invariant.
import {
  type AnyContract,
  contract,
  focusAttrs,
  type PlatformFlags,
  platforms,
  quirkActive,
  type SchedulerEnv,
  scopeAttrs,
  setup,
  type,
} from "@rind-ui/core"
import { render } from "@testing-library/react"
import { type ReactElement, useEffect, useRef, useState } from "react"
import { describe, expect, it } from "vitest"
import { toggleContract } from "../fixtures/press/press.contract"
import { ToggleButton } from "../fixtures/press/press.react"
import { currentRun, domEnv, installAnnouncementLog, testMachine } from "./index"

/** Runs testMachine with a collecting registrar; returns each test's name and failure. */
async function failuresOf<C extends AnyContract>(
  c: C,
  ui: () => ReactElement,
  options: {
    anchor: string
    props?: Record<string, unknown>
    platforms?: readonly PlatformFlags[]
  },
) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(c, {
    test: (name, fn) => tests.push({ name, fn }),
    setup: () => render(ui()),
    target: () => domEnv({ timeout: 200 }),
    anchor: [options.anchor] as never,
    ...(options.props ? { props: options.props as never } : {}),
    ...(options.platforms ? { platforms: options.platforms } : {}),
  })
  const out: { name: string; error: string | null }[] = []
  for (const t of tests) {
    const error = await t.fn().then(
      () => null,
      (e: Error) => e.message,
    )
    document.body.innerHTML = ""
    installAnnouncementLog().length = 0
    out.push({ name: t.name, error })
  }
  return out
}
const errors = (results: { error: string | null }[]) =>
  results.map((r) => r.error).filter((e): e is string => e !== null)

describe("broken variants fail with the invariant's name", () => {
  it("ring after click → focus-visible-modality", { timeout: 30_000 }, async () => {
    const results = await failuresOf(
      toggleContract,
      () => (
        <ToggleButton
          // Broken: shows the ring whenever focused, whatever the input.
          onFocus={(e) => e.currentTarget.setAttribute("data-focus-visible", "")}
        >
          Bold
        </ToggleButton>
      ),
      { anchor: "Bold", props: { disabled: undefined } },
    )
    const pointer = results.filter((r) => r.name.includes("[pointer"))
    expect(pointer.some((r) => r.error?.includes("data-focus-visible after a pointer step"))).toBe(
      true,
    )
  })

  it("double toggle on a bare click → virtual-parity", { timeout: 30_000 }, async () => {
    const results = await failuresOf(
      toggleContract,
      () => {
        function Double() {
          const [pressed, setPressed] = useState(false)
          return (
            <ToggleButton
              pressed={pressed}
              onPressedChange={() => setPressed((p) => !p)}
              // Broken: a second activation for clicks with detail 0.
              onClick={(e) => e.detail === 0 && setPressed((p) => !p)}
            >
              Bold
            </ToggleButton>
          )
        }
        return <Double />
      },
      { anchor: "Bold", props: { disabled: undefined } },
    )
    const virtual = results.filter((r) => r.name.includes("[virtual"))
    expect(virtual.length).toBeGreaterThan(0)
    expect(virtual.every((r) => r.error?.includes("virtual-parity"))).toBe(true)
    expect(results.filter((r) => r.name.includes("[pointer")).every((r) => r.error === null)).toBe(
      true,
    )
  })

  it("tab selected on focus → focus-does-not-commit (RX#1047)", { timeout: 30_000 }, async () => {
    const tabs = setup({
      types: type<{
        props: object
        events: { type: "SELECT_A" } | { type: "SELECT_B" }
        env: object
      }>(),
    }).machine({
      id: "tabs",
      initial: "a",
      states: { a: { on: { SELECT_B: "b" } }, b: { on: { SELECT_A: "a" } } },
    })
    const tabsContract = contract("tabs", {
      machine: tabs,
      anatomy: ["list", "tab"],
      locate: (name: string) => ({ role: "tablist", name }),
      queries: {
        selected: async (env) =>
          (await env.part("tab", { role: "tab", name: "B" }).attr("aria-selected")) === "true"
            ? "b"
            : "a",
      },
      actions: {
        selectA: {
          pointer: (env) => env.part("tab", { role: "tab", name: "A" }).click(),
          keyboard: (env) => env.part("tab", { role: "tab", name: "A" }).press("Enter"),
          done: { selected: "a" },
        },
        selectB: {
          pointer: (env) => env.part("tab", { role: "tab", name: "B" }).click(),
          keyboard: (env) => env.part("tab", { role: "tab", name: "B" }).press("Enter"),
          done: { selected: "b" },
        },
      },
      states: { a: { selected: "a" }, b: { selected: "b" } },
      events: { SELECT_A: "selectA", SELECT_B: "selectB" },
      traits: [],
    })
    function Tabs() {
      const [selected, setSelected] = useState<"a" | "b">("a")
      const attrs = (part: string) => scopeAttrs("tabs", part, "t1")
      const tab = (id: "a" | "b") => (
        <button
          type="button"
          role="tab"
          {...attrs("tab")}
          aria-selected={selected === id}
          data-selected={selected === id ? "" : undefined}
          onClick={() => setSelected(id)}
          onKeyDown={(e) => e.key === "Enter" && setSelected(id)}
          // Broken: focus alone selects (the screen-reader cursor would select it).
          onFocus={() => setSelected(id)}
          onPointerDown={() => setSelected(id)}
          data-focus-visible=""
        >
          {id.toUpperCase()}
        </button>
      )
      return (
        <div role="tablist" aria-label="Sections" {...attrs("list")}>
          {tab("a")}
          {tab("b")}
        </div>
      )
    }
    const results = await failuresOf(tabsContract, () => <Tabs />, { anchor: "Sections" })
    expect(errors(results).some((e) => e.includes("focus-does-not-commit"))).toBe(true)
  })

  it("composing Enter submits → ime-never-commits", { timeout: 30_000 }, async () => {
    const prompt = setup({
      types: type<{ props: object; events: { type: "SUBMIT" }; env: object }>(),
    }).machine({
      id: "prompt",
      initial: "idle",
      states: { idle: { on: { SUBMIT: "sent" } }, sent: {} },
    })
    const promptContract = contract("prompt", {
      machine: prompt,
      anatomy: ["input"],
      locate: (name: string) => ({ role: "textbox", name }),
      queries: { sent: async (env) => (await env.part("input").attr("data-sent")) === "true" },
      actions: {
        submit: { keyboard: (env) => env.part("input").press("Enter"), done: { sent: true } },
      },
      states: { idle: { sent: false }, sent: { sent: true } },
      events: { SUBMIT: "submit" },
      traits: [],
    })
    function Prompt() {
      const [sent, setSent] = useState(false)
      const [focused, setFocused] = useState(false)
      return (
        <input
          aria-label="Message"
          {...scopeAttrs("prompt", "input", "p1")}
          {...focusAttrs(focused, "keyboard")}
          data-sent={String(sent)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // Broken: ignores isComposing / keyCode 229.
          onKeyDown={(e) => e.key === "Enter" && setSent(true)}
        />
      )
    }
    const results = await failuresOf(promptContract, () => <Prompt />, { anchor: "Message" })
    expect(errors(results).some((e) => e.includes("ime-never-commits: composing Enter"))).toBe(true)
  })

  it("hover from touch → no-touch-hover", { timeout: 30_000 }, async () => {
    const tip = setup({
      types: type<{ props: object; events: { type: "HOVER" }; env: object }>(),
    }).machine({
      id: "tip",
      initial: "closed",
      states: { closed: { on: { HOVER: "open" } }, open: {} },
    })
    const tipContract = contract("tip", {
      machine: tip,
      anatomy: ["trigger"],
      locate: (name: string) => ({ role: "button", name }),
      queries: { open: async (env) => (await env.part("trigger").attr("data-state")) === "open" },
      actions: {
        hover: {
          pointer: (env) => env.part("trigger").hover(),
          none: { keyboard: "focus opens it in the real component; not modelled in this fixture" },
          done: { open: true },
        },
      },
      states: { closed: { open: false }, open: { open: true } },
      events: { HOVER: "hover" },
      traits: [],
    })
    function Tip() {
      const [open, setOpen] = useState(false)
      return (
        <button
          type="button"
          {...scopeAttrs("tip", "trigger", "t1")}
          data-state={open ? "open" : "closed"}
          data-hover={open ? "" : undefined}
          // Broken: opens for touch "hovers" too.
          onPointerEnter={() => setOpen(true)}
        >
          Info
        </button>
      )
    }
    const results = await failuresOf(tipContract, () => <Tip />, { anchor: "Info" })
    expect(errors(results).some((e) => e.includes("no-touch-hover"))).toBe(true)
  })

  describe("no-touch-hover and focus checks (review round 1)", () => {
    const tip = setup({
      types: type<{
        props: object
        events: { type: "HOVER" } | { type: "LEAVE" }
        env: SchedulerEnv
      }>(),
      delays: { openDelay: () => 300 },
    }).machine({
      id: "tip",
      initial: "closed",
      states: {
        closed: { on: { HOVER: "opening" } },
        opening: { after: { openDelay: "open" }, on: { LEAVE: "closed" } },
        open: { on: { LEAVE: "closed" } },
      },
    })
    const tipContract = contract("tip", {
      machine: tip,
      anatomy: ["root", "trigger", "other"],
      locate: (name: string) => ({ role: "group", name }),
      queries: { open: async (env) => (await env.part("trigger").attr("data-state")) === "open" },
      actions: {
        hover: {
          pointer: (env) => env.part("trigger").hover(),
          none: { keyboard: "focus opens it in the real component; not modelled here" },
          done: async () => true,
        },
        leave: {
          pointer: (env) => env.part("other").hover(),
          none: { keyboard: "blur closes it in the real component; not modelled here" },
          done: { open: false },
        },
      },
      states: { closed: { open: false }, opening: { open: false }, open: { open: true } },
      events: { HOVER: "hover", LEAVE: "leave" },
      traits: [],
    })
    function Tip({ touchOpens }: { touchOpens: boolean }) {
      const [open, setOpen] = useState(false)
      const [hover, setHover] = useState(false)
      const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
      return (
        <fieldset aria-label="Tip" {...scopeAttrs("tip", "root", "t1")}>
          <button
            type="button"
            {...scopeAttrs("tip", "trigger", "t1")}
            data-state={open ? "open" : "closed"}
            data-hover={hover ? "" : undefined}
            onPointerEnter={(e) => {
              // Broken variant: a touch "hover" starts the (delayed) open too.
              if (e.pointerType === "touch" && !touchOpens) return
              if (e.pointerType !== "touch") setHover(true)
              timer.current = setTimeout(() => setOpen(true), 300)
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "touch") return
              if (timer.current) clearTimeout(timer.current)
              setHover(false)
              setOpen(false)
            }}
          >
            Info
          </button>
          <span {...scopeAttrs("tip", "other", "t1")}>Elsewhere</span>
        </fieldset>
      )
    }

    it("a correct tooltip passes, though an earlier mouse hover leaves data-hover", {
      timeout: 60_000,
    }, async () => {
      const results = await failuresOf(tipContract, () => <Tip touchOpens={false} />, {
        anchor: "Tip",
      })
      expect(errors(results)).toEqual([])
    })

    it("a touch that opens after the machine's delay → no-touch-hover", {
      timeout: 60_000,
    }, async () => {
      const results = await failuresOf(tipContract, () => <Tip touchOpens />, { anchor: "Tip" })
      expect(errors(results).some((e) => e.includes("no-touch-hover") && e.includes("open"))).toBe(
        true,
      )
    })

    it("focus that changes a value outside the state's queries → focus-does-not-commit (RX#1047)", {
      timeout: 30_000,
    }, async () => {
      const tabs = setup({
        types: type<{ props: object; events: { type: "SELECT" }; env: object }>(),
      }).machine({ id: "tabs", initial: "idle", states: { idle: { on: { SELECT: {} } } } })
      const tabsContract = contract("tabs", {
        machine: tabs,
        anatomy: ["list", "tab"],
        locate: (name: string) => ({ role: "tablist", name }),
        queries: {
          // Kept in context by a real Tabs machine: not part of any state's expectations.
          selected: async (env) => (await env.part("list").attr("data-value")) ?? "",
        },
        actions: {
          select: {
            keyboard: (env) => env.part("tab", { role: "tab", name: "A" }).press("Enter"),
            done: { selected: "a" },
          },
        },
        states: { idle: {} },
        events: { SELECT: "select" },
        traits: [],
      })
      function Tabs() {
        const [value, setValue] = useState("a")
        const attrs = (part: string) => scopeAttrs("tabs", part, "t1")
        return (
          <div role="tablist" aria-label="Sections" {...attrs("list")} data-value={value}>
            {["a", "b"].map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                {...attrs("tab")}
                aria-selected={value === id}
                data-selected={value === id ? "" : undefined}
                data-focus-visible=""
                onKeyDown={(e) => e.key === "Enter" && setValue(id)}
                // Broken: the screen-reader cursor landing on a tab selects it.
                onFocus={() => setValue(id)}
              >
                {id.toUpperCase()}
              </button>
            ))}
          </div>
        )
      }
      const results = await failuresOf(tabsContract, () => <Tabs />, { anchor: "Sections" })
      expect(
        errors(results).some(
          (e) => e.includes("focus-does-not-commit") && e.includes("changed selected"),
        ),
      ).toBe(true)
    })
  })

  describe("IME: printable characters (review round 1)", () => {
    const search = setup({
      types: type<{ props: object; events: { type: "TYPE" }; env: object }>(),
    }).machine({ id: "search", initial: "idle", states: { idle: { on: { TYPE: {} } } } })
    const searchContract = contract("search", {
      machine: search,
      anatomy: ["input"],
      locate: (name: string) => ({ role: "combobox", name }),
      queries: { match: async (env) => (await env.part("input").attr("data-match")) ?? "" },
      actions: {
        type: { keyboard: (env) => env.part("input").type("b"), done: { match: "Banana" } },
      },
      states: { idle: {} },
      events: { TYPE: "type" },
      traits: [],
    })
    function Search({ ignoreComposing }: { ignoreComposing: boolean }) {
      const [match, setMatch] = useState("")
      const [focused, setFocused] = useState(false)
      return (
        <input
          role="combobox"
          aria-label="Fruit"
          aria-expanded={false}
          {...scopeAttrs("search", "input", "s1")}
          {...focusAttrs(focused, "keyboard")}
          data-match={match}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            // The correct variant waits for the composition to end.
            if (ignoreComposing && (e.nativeEvent as InputEvent).isComposing) return
            const text = e.currentTarget.value
            setMatch(
              ["Apple", "Banana"].find((o) => text && o.toLowerCase().startsWith(text)) ?? "",
            )
          }}
        />
      )
    }

    it("typeahead that reacts while an IME composes → ime-never-commits", {
      timeout: 30_000,
    }, async () => {
      const results = await failuresOf(searchContract, () => <Search ignoreComposing={false} />, {
        anchor: "Fruit",
      })
      expect(errors(results).some((e) => e.includes('ime-never-commits: composing "b"'))).toBe(true)
    })

    it("typeahead that waits for the composition to end passes", {
      timeout: 30_000,
    }, async () => {
      const results = await failuresOf(searchContract, () => <Search ignoreComposing />, {
        anchor: "Fruit",
      })
      expect(errors(results)).toEqual([])
    })
  })

  describe("announcement parity (composite-activedescendant)", () => {
    const combo = setup({
      types: type<{ props: object; events: { type: "OPEN" } | { type: "NEXT" }; env: object }>(),
    }).machine({
      id: "combo",
      initial: "closed",
      states: { closed: { on: { OPEN: "open" } }, open: { on: { NEXT: {} } } },
    })
    const options = ["Apple", "Banana", "Cherry"]
    const comboContract = contract("combo", {
      machine: combo,
      anatomy: ["input", "listbox", "item"],
      locate: (name: string) => ({ role: "combobox", name }),
      queries: {
        expanded: async (env) => (await env.part("input").attr("aria-expanded")) === "true",
        highlighted: async (env) => {
          const id = await env.part("input").attr("aria-activedescendant")
          return id ? id.replace("combo-opt-", "") : ""
        },
      },
      actions: {
        open: {
          keyboard: (env) => env.part("input").press("ArrowDown"),
          done: { expanded: true },
        },
        next: { keyboard: (env) => env.part("input").press("ArrowDown"), done: async () => true },
      },
      states: { closed: { expanded: false }, open: { expanded: true } },
      events: { OPEN: "open", NEXT: "next" },
      traits: ["composite-activedescendant"],
      announcements: {
        focusAnnouncement: (o) => `${o.highlighted}`,
        countAnnouncement: () => "3 results",
        selectionAnnouncement: (o) => `${o.highlighted}, selected`,
      },
    })
    type Mode = "correct" | "no-highlight" | "highlight-everywhere" | "no-count"
    const say = (message: string) => installAnnouncementLog().push({ message, priority: "polite" })
    function Combo({ mode }: { mode: Mode }) {
      const [open, setOpen] = useState(false)
      const [index, setIndex] = useState(-1)
      const [focused, setFocused] = useState(false)
      const platform = currentRun()?.platform ?? platforms.linux
      useEffect(() => {
        // The count is a status message everywhere.
        if (open && mode !== "no-count") say(`${options.length} results`)
      }, [open, mode])
      useEffect(() => {
        if (index < 0 || mode === "no-highlight") return
        // VoiceOver in Safari does not speak aria-activedescendant changes.
        if (mode === "highlight-everywhere" || quirkActive("vo-activedescendant", { platform })) {
          say(options[index] ?? "")
        }
      }, [index, mode, platform])
      const a = (part: string) => scopeAttrs("combo", part, "c1")
      return (
        <div>
          <input
            role="combobox"
            aria-label="Fruit"
            aria-expanded={open}
            aria-controls="combo-list"
            aria-activedescendant={index >= 0 ? `combo-opt-${options[index]}` : undefined}
            {...a("input")}
            {...focusAttrs(focused, "keyboard")}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown" || e.nativeEvent.isComposing) return
              e.preventDefault()
              if (!open) setOpen(true)
              else setIndex((i) => Math.min(i + 1, options.length - 1))
            }}
          />
          <div role="listbox" id="combo-list" aria-label="Fruits" hidden={!open} {...a("listbox")}>
            {options.map((o, i) => (
              <div
                key={o}
                role="option"
                tabIndex={-1}
                id={`combo-opt-${o}`}
                aria-selected="false"
                {...a("item")}
                data-highlighted={i === index ? "" : undefined}
                data-focus={i === index ? "" : undefined}
                data-focus-visible={i === index ? "" : undefined}
              >
                {o}
              </div>
            ))}
          </div>
        </div>
      )
    }
    const run = (mode: Mode) =>
      failuresOf(comboContract, () => <Combo mode={mode} />, { anchor: "Fruit" })
    const on = (label: string) => (r: { name: string }) =>
      new RegExp(`[[ ,]${label}[\\],]`).test(r.name)

    it("count everywhere, highlight on Apple+WebKit only: passes on all three platforms", {
      timeout: 30_000,
    }, async () => {
      const results = await run("correct")
      for (const label of ["apple", "apple-blink", "windows"]) {
        expect(results.some(on(label)), label).toBe(true)
      }
      expect(errors(results)).toEqual([])
    })

    it("missing highlight on Apple+WebKit → announcement-parity (RA#10326)", {
      timeout: 30_000,
    }, async () => {
      const results = await run("no-highlight")
      expect(
        results
          .filter(on("apple"))
          .some((r) => r.error?.includes('the focus announcement "Apple"; heard []')),
      ).toBe(true)
      expect(results.filter(on("windows")).every((r) => r.error === null)).toBe(true)
    })

    it("highlight announced on Apple+Blink → announcement-parity (RA PR #10503)", {
      timeout: 30_000,
    }, async () => {
      const results = await run("highlight-everywhere")
      const blink = results.filter(on("apple-blink"))
      expect(blink.some((r) => r.error?.includes("double speech"))).toBe(true)
      expect(results.filter(on("windows")).some((r) => r.error?.includes("double speech"))).toBe(
        true,
      )
      expect(results.filter(on("apple")).every((r) => r.error === null)).toBe(true)
    })

    it("count missing on Windows → announcement-parity", { timeout: 30_000 }, async () => {
      const results = await run("no-count")
      expect(
        results
          .filter(on("windows"))
          .some((r) => r.error?.includes('expected the count announcement "3 results"')),
      ).toBe(true)
    })
  })
})
