// Model-based tests (task 5.1): the Accordion contract over multiple × collapsible ×
// keyboardNavigation, in pointer, keyboard and virtual (and RTL: the contract is
// directional), for each argument class of the item events (the first item, another item,
// a disabled item), plus a consumer wrapper that breaks the heading invariant.
import { accordionArgs, accordionContract, platforms } from "@rind-ui/core"
import { Accordion, RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, expect, it } from "vitest"
import { accordionStepInvariants, currentRun, domEnv, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const ITEMS = [
  { item: "a", label: "Shipping" },
  { item: "b", label: "Returns" },
  { item: "c", label: "Payment" },
] as const
const classes = {
  first: ITEMS[0],
  another: ITEMS[1],
  disabled: ITEMS[2],
} as const

type Cfg = { multiple: boolean; collapsible: boolean; keyboardNavigation: boolean }
// Every prop the machine reads, as the component receives it.
const base = {
  value: undefined,
  defaultValue: undefined,
  onValueChange: undefined,
  disabled: undefined,
  triggerOrder: undefined,
  focusTrigger: undefined,
}
const anchor = [{ item: "Shipping" }] as never

/** The value the consumer tracks through onValueChange, read by the step invariants. */
let tracked: readonly string[] = []
const labels = Object.fromEntries(ITEMS.map(({ item, label }) => [item, label]))
const steps = accordionStepInvariants({ value: () => tracked, labels })

const ui = (cfg: Cfg, disabledItem: boolean, dir: "ltr" | "rtl") => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    <Accordion.Root
      {...cfg}
      dir={dir}
      onValueChange={(v) => {
        tracked = v
      }}
    >
      {ITEMS.map(({ item, label }) => (
        <Accordion.Item key={item} value={item} disabled={disabledItem && item === "c"}>
          <Accordion.Header>
            <Accordion.Trigger>
              {label} <Accordion.Indicator />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <p>{label} details</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  </RindProvider>
)

for (const multiple of [false, true]) {
  for (const collapsible of multiple ? [true] : [true, false]) {
    for (const keyboardNavigation of [false, true]) {
      for (const [name, cls] of Object.entries(classes)) {
        const cfg = { multiple, collapsible, keyboardNavigation }
        const disabledItem = name === "disabled"
        describe(`accordion model: ${JSON.stringify(cfg)}, ${name} item`, () => {
          testMachine(accordionContract, {
            test: it,
            setup: () => {
              accordionArgs.current = cls
              tracked = []
              steps.reset()
              return render(ui(cfg, disabledItem, currentRun()?.direction ?? "ltr"))
            },
            target: () => screen,
            anchor,
            props: { ...base, ...cfg } as never,
            invariants: steps.invariants,
            a11y,
          })
        })
      }
    }
  }
}

describe("accordion model: a wrapper that renders the trigger outside any heading", () => {
  it("fails the heading invariant naming the item", async () => {
    const tests: { name: string; fn: () => Promise<void> }[] = []
    testMachine(accordionContract, {
      test: (name, fn) => tests.push({ name, fn }),
      setup: () => {
        accordionArgs.current = classes.first
        return render(
          <Accordion.Root>
            <Accordion.Item value="a">
              <Accordion.Trigger>Shipping</Accordion.Trigger>
              <Accordion.Content>Body</Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>,
        )
      },
      target: () => domEnv({ timeout: 200 }),
      anchor,
      props: { ...base, multiple: false, collapsible: true, keyboardNavigation: false } as never,
      modalities: ["pointer"],
    })
    const errors: string[] = []
    for (const t of tests) {
      await t.fn().catch((e: Error) => errors.push(e.message))
      document.body.innerHTML = ""
    }
    expect(errors.join("\n")).toMatch(/accordion-heading: the trigger of item "Shipping"/)
  })
})

/** Runs the contract on a broken variant and returns every failure message. */
async function failures(
  ui: () => React.ReactElement,
  cfg: Cfg,
  modalities: ("pointer" | "keyboard")[],
  initial: readonly string[] = [],
) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(accordionContract, {
    test: (name, fn) => tests.push({ name, fn }),
    setup: () => {
      accordionArgs.current = classes.first
      tracked = initial
      steps.reset()
      return render(ui())
    },
    target: () => domEnv({ timeout: 200 }),
    anchor,
    props: { ...base, ...cfg } as never,
    invariants: steps.invariants,
    modalities,
  })
  const errors: string[] = []
  for (const t of tests) {
    await t.fn().catch((e: Error) => errors.push(e.message))
    document.body.innerHTML = ""
  }
  return errors.join("\n")
}

describe("accordion model: broken variants fail the step invariants by name", () => {
  it("a close that is not reported (ark#1656)", async () => {
    const cfg = { multiple: true, collapsible: true, keyboardNavigation: false }
    const out = await failures(
      () => (
        <Accordion.Root
          multiple
          defaultValue={["a"]}
          onValueChange={(v) => {
            // The bug: only growing values reach the consumer.
            if (v.length >= tracked.length) tracked = v
          }}
        >
          {ITEMS.map(({ item, label }) => (
            <Accordion.Item key={item} value={item}>
              <Accordion.Header>
                <Accordion.Trigger>{label}</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content>{label} details</Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      ),
      cfg,
      ["pointer"],
      ["a"],
    )
    expect(out).toMatch(/accordion-expanded-matches-value: "Shipping" is collapsed/)
  })

  it("a consumer that moves focus on ArrowDown without keyboardNavigation", async () => {
    const cfg = { multiple: false, collapsible: true, keyboardNavigation: false }
    const out = await failures(
      () => (
        <Accordion.Root
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown") return
            e.preventDefault()
            const all = Array.from(e.currentTarget.querySelectorAll("button"))
            all[(all.indexOf(e.target as HTMLButtonElement) + 1) % all.length]?.focus()
          }}
        >
          {ITEMS.map(({ item, label }) => (
            <Accordion.Item key={item} value={item}>
              <Accordion.Header>
                <Accordion.Trigger>{label}</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content>{label} details</Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      ),
      cfg,
      ["keyboard"],
    )
    expect(out).toMatch(/accordion-arrows-inert: ArrowDown on a trigger was prevented/)
  })
})
