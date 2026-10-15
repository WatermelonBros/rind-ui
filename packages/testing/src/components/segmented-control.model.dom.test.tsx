// Model-based tests (task 6.1): the Segmented Control contract over every transition in
// pointer, touch, keyboard and virtual, LTR and RTL, for the argument classes (no value,
// disabled segment, read-only, required) with the composite-roving, selectable,
// focus-does-not-commit, virtual-parity, form-associated and tab-stop invariants;
// INDICATOR.MEASURE is excluded (environment event); broken variants (6.2).
import {
  createListCollection,
  platforms,
  segmentedControlArgs,
  segmentedControlContract,
} from "@rind-ui/core"
import { RindProvider, SegmentedControl } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { currentRun, domEnv, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const RANGES = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
]
const anchor = [{ name: "Range" }] as never

interface Cfg {
  readonly defaultValue?: string
  readonly disabled?: readonly string[]
  readonly root?: Partial<Parameters<typeof SegmentedControl.Root>[0]>
}

const collectionOf = (disabled: readonly string[] = []) =>
  createListCollection({
    items: RANGES,
    getKey: (i) => i.value,
    getText: (i) => i.label,
    isDisabled: (i) => disabled.includes(i.value),
  })

function Range({ cfg }: { cfg: Cfg }) {
  return (
    <RindProvider
      environment={{ platform: currentRun()?.platform ?? platforms.linux }}
      dir={currentRun()?.direction ?? "ltr"}
    >
      <form>
        <SegmentedControl.Root
          name="range"
          {...(cfg.defaultValue ? { defaultValue: cfg.defaultValue } : {})}
          {...cfg.root}
        >
          <SegmentedControl.Label>Range</SegmentedControl.Label>
          {RANGES.map((r) => (
            <SegmentedControl.Item
              key={r.value}
              value={r.value}
              disabled={cfg.disabled?.includes(r.value) === true}
            >
              {r.label}
            </SegmentedControl.Item>
          ))}
          <SegmentedControl.Indicator />
        </SegmentedControl.Root>
        <button type="button">After</button>
      </form>
    </RindProvider>
  )
}

const configs: { name: string; cfg: Cfg }[] = [
  { name: "no value", cfg: {} },
  { name: "disabled segment", cfg: { defaultValue: "day", disabled: ["week"] } },
  { name: "read-only", cfg: { defaultValue: "day", root: { readOnly: true } } },
  { name: "required", cfg: { root: { required: true } } },
]

// Every prop the machine reads, as the component receives it.
const propsOf = (cfg: Cfg) => ({
  collection: collectionOf(cfg.disabled),
  strategy: "roving",
  ids: { list: "root", item: (k: string) => `item-${k}` },
  loop: true,
  selectionMode: "single",
  focusableWhenDisabled: false,
  value: undefined,
  defaultValue: cfg.defaultValue,
  onValueChange: undefined,
  disabled: cfg.root?.disabled ?? false,
  readOnly: cfg.root?.readOnly ?? false,
})

for (const { name, cfg } of configs) {
  describe(`segmented control model: ${name}`, () => {
    testMachine(segmentedControlContract, {
      test: it,
      setup: () => {
        segmentedControlArgs.current = { key: "month", label: "Month" }
        return render(<Range cfg={cfg} />)
      },
      target: () => screen,
      anchor,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

/** Every failure of the contract run on a broken variant. */
async function failures(ui: () => ReactElement) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(segmentedControlContract, {
    test: (n, fn) => tests.push({ name: n, fn }),
    setup: () => {
      segmentedControlArgs.current = { key: "month", label: "Month" }
      return render(ui())
    },
    target: () => domEnv({ timeout: 200 }),
    anchor,
    props: propsOf({}) as never,
    modalities: ["keyboard", "pointer"],
  })
  const out: string[] = []
  for (const t of tests) {
    await t.fn().catch((e: Error) => out.push(e.message))
    document.body.innerHTML = ""
  }
  return out.join("\n")
}

const broken = (item: (r: (typeof RANGES)[number]) => ReactElement) => () => (
  <form>
    <SegmentedControl.Root name="range">
      <SegmentedControl.Label>Range</SegmentedControl.Label>
      {RANGES.map(item)}
    </SegmentedControl.Root>
    <button type="button">After</button>
  </form>
)

describe("broken Segmented Controls fail readably (6.2)", () => {
  it("toggle-button semantics (aria-pressed)", { timeout: 60_000 }, async () => {
    const out = await failures(
      broken((r) => (
        <SegmentedControl.Item
          key={r.value}
          value={r.value}
          render={(p) => {
            // Broken: a toggle button (aria-pressed) instead of a radio.
            const { role: _role, "aria-checked": checked, ...q } = p as Record<string, unknown>
            return <button {...q} type="button" aria-pressed={checked === "true"} />
          }}
        >
          {r.label}
        </SegmentedControl.Item>
      )),
    )
    expect(out).toMatch(/has no explicit aria-selected\/aria-checked/)
  })

  it("arrows that only move focus", { timeout: 60_000 }, async () => {
    const out = await failures(
      broken((r) => (
        <SegmentedControl.Item
          key={r.value}
          value={r.value}
          // Broken: arrow keys only move focus (Toggle Group's rule).
          onKeyDown={(e) => {
            if (!e.key.startsWith("Arrow")) return
            e.preventDefault()
            e.stopPropagation()
            const next =
              e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')
            const list = next ? [...next] : []
            list[(list.indexOf(e.currentTarget) + 1) % list.length]?.focus()
          }}
        >
          {r.label}
        </SegmentedControl.Item>
      )),
    )
    expect(out).toMatch(/selected items|differ from the machine's value|hidden input|checked/i)
  })

  it("a leaked radio-group scope (ark#2629)", { timeout: 60_000 }, async () => {
    const out = await failures(
      broken((r) => (
        <SegmentedControl.Item key={r.value} value={r.value} data-scope="radio-group">
          {r.label}
        </SegmentedControl.Item>
      )),
    )
    expect(out).toMatch(/segmented-control\.item \(role "radio" named "Month"\): not found/)
  })
})
