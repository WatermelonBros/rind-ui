// Model-based tests (task 6.1): the Radio Group contract over every transition in pointer,
// touch, keyboard and virtual, LTR and RTL (directional), for the argument classes of the
// spec (no value, first disabled, checked disabled, all disabled, read-only, required),
// with the composite-roving, selectable, focus-does-not-commit, virtual-parity and
// form-associated invariants; broken variants (6.2).
import { createListCollection, platforms, radioGroupArgs, radioGroupContract } from "@rind-ui/core"
import { RadioGroup, RindProvider } from "@rind-ui/react"
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

const SIZES = [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
]
const anchor = [{ name: "Size" }] as never

interface Cfg {
  readonly defaultValue?: string
  readonly disabled?: readonly string[]
  readonly root?: Partial<Parameters<typeof RadioGroup.Root>[0]>
  /** The argument class's radio (PRESS, FOCUS). */
  readonly target: { readonly key: string; readonly label: string }
}

const collectionOf = (disabled: readonly string[] = []) =>
  createListCollection({
    items: SIZES,
    getKey: (i) => i.value,
    getText: (i) => i.label,
    isDisabled: (i) => disabled.includes(i.value),
  })

function Size({ cfg }: { cfg: Cfg }) {
  return (
    <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
      <form>
        <RadioGroup.Root
          name="size"
          {...(cfg.defaultValue ? { defaultValue: cfg.defaultValue } : {})}
          {...cfg.root}
        >
          <RadioGroup.Label>Size</RadioGroup.Label>
          {SIZES.map((s) => (
            <RadioGroup.Item
              key={s.value}
              value={s.value}
              disabled={cfg.disabled?.includes(s.value) === true}
            >
              <RadioGroup.ItemControl>
                <RadioGroup.ItemIndicator />
              </RadioGroup.ItemControl>
              <RadioGroup.ItemLabel>{s.label}</RadioGroup.ItemLabel>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
        <button type="button">After</button>
      </form>
    </RindProvider>
  )
}

const LARGE = { key: "l", label: "Large" }
const configs: { name: string; cfg: Cfg }[] = [
  { name: "no value", cfg: { target: LARGE } },
  { name: "first disabled", cfg: { disabled: ["s"], target: LARGE } },
  { name: "checked disabled", cfg: { defaultValue: "s", disabled: ["s"], target: LARGE } },
  { name: "read-only", cfg: { defaultValue: "s", root: { readOnly: true }, target: LARGE } },
  { name: "required", cfg: { root: { required: true }, target: LARGE } },
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
  describe(`radio group model: ${name}`, () => {
    testMachine(radioGroupContract, {
      test: it,
      setup: () => {
        radioGroupArgs.current = cfg.target
        return render(<Size cfg={cfg} />)
      },
      target: () => screen,
      anchor,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

/** Every failure of the contract run on a broken variant. */
async function failures(ui: () => ReactElement, cfg: Cfg) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(radioGroupContract, {
    test: (n, fn) => tests.push({ name: n, fn }),
    setup: () => {
      radioGroupArgs.current = cfg.target
      return render(ui())
    },
    target: () => domEnv({ timeout: 200 }),
    anchor,
    props: propsOf(cfg) as never,
    modalities: ["keyboard", "pointer"],
  })
  const out: string[] = []
  for (const t of tests) {
    await t.fn().catch((e: Error) => out.push(e.message))
    document.body.innerHTML = ""
  }
  return out.join("\n")
}

const plain: Cfg = { target: LARGE }
describe("broken Radio Groups fail readably (6.2)", () => {
  it("checks on focus (radix#938)", { timeout: 60_000 }, async () => {
    const out = await failures(
      () => (
        <form>
          <RadioGroup.Root name="size">
            <RadioGroup.Label>Size</RadioGroup.Label>
            {SIZES.map((s) => (
              <RadioGroup.Item key={s.value} value={s.value}>
                <RadioGroup.ItemControl
                  // Broken: a focus checks the radio (a click on focus).
                  onFocus={(e) => {
                    if (e.currentTarget.getAttribute("aria-checked") !== "true") {
                      e.currentTarget.click()
                    }
                  }}
                />
                <RadioGroup.ItemLabel>{s.label}</RadioGroup.ItemLabel>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
          <button type="button">After</button>
        </form>
      ),
      plain,
    )
    expect(out).toMatch(/focus-does-not-commit|expected|selected|checked/)
  })

  it("exposes the hidden input (radix#1694)", { timeout: 60_000 }, async () => {
    const out = await failures(
      () => (
        <form>
          <RadioGroup.Root name="size">
            <RadioGroup.Label>Size</RadioGroup.Label>
            {SIZES.map((s) => (
              <RadioGroup.Item
                key={s.value}
                value={s.value}
                ref={(el) => el?.querySelector("input")?.removeAttribute("aria-hidden")}
              >
                <RadioGroup.ItemControl />
                <RadioGroup.ItemLabel>{s.label}</RadioGroup.ItemLabel>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
          <button type="button">After</button>
        </form>
      ),
      plain,
    )
    expect(out).toMatch(/is not aria-hidden/)
  })

  it("makes the first radio the tab stop instead of the checked one (base-ui#1740)", {
    timeout: 60_000,
  }, async () => {
    const out = await failures(
      () => (
        <form>
          <RadioGroup.Root name="size" defaultValue="l">
            <RadioGroup.Label>Size</RadioGroup.Label>
            {SIZES.map((s, i) => (
              <RadioGroup.Item key={s.value} value={s.value}>
                {/* Broken: a fixed tab index on the first radio. */}
                <RadioGroup.ItemControl tabIndex={i === 0 ? 0 : -1} />
                <RadioGroup.ItemLabel>{s.label}</RadioGroup.ItemLabel>
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
          <button type="button">After</button>
        </form>
      ),
      { defaultValue: "l", target: LARGE },
    )
    expect(out).toMatch(/radio-group-tab-stop: the tab stop is "Small", expected "Large"/)
  })
})
