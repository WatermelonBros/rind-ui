// Model-based tests (task 5.1): the Toggle Group contract over every transition in pointer,
// touch, keyboard and virtual, LTR and RTL, for the argument classes (single, multiple,
// disallowEmptySelection, vertical, all disabled), with the per-component aria-pressed
// invariant; broken variants (5.2).
import {
  createListCollection,
  platforms,
  toggleGroupArgs,
  toggleGroupContract,
} from "@rind-ui/core"
import { RindProvider, ToggleGroup } from "@rind-ui/react"
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

const ITEMS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
]
const anchor = [{ name: "Alignment" }] as never

type RootProps = Parameters<typeof ToggleGroup.Root>[0]
interface Cfg {
  readonly root?: Partial<RootProps>
  readonly disabled?: readonly string[]
}

const collectionOf = (disabled: readonly string[] = []) =>
  createListCollection({
    items: ITEMS,
    getKey: (i) => i.value,
    getText: (i) => i.label,
    isDisabled: (i) => disabled.includes(i.value),
  })

function Align({ cfg }: { cfg: Cfg }) {
  return (
    <RindProvider
      environment={{ platform: currentRun()?.platform ?? platforms.linux }}
      dir={currentRun()?.direction ?? "ltr"}
    >
      <ToggleGroup.Root aria-label="Alignment" {...cfg.root}>
        {ITEMS.map((i) => (
          <ToggleGroup.Item
            key={i.value}
            value={i.value}
            disabled={cfg.disabled?.includes(i.value) === true}
          >
            {i.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <button type="button">After</button>
    </RindProvider>
  )
}

const configs: { name: string; cfg: Cfg }[] = [
  { name: "single", cfg: {} },
  { name: "multiple", cfg: { root: { selectionMode: "multiple" } } },
  {
    name: "disallowEmptySelection",
    cfg: { root: { disallowEmptySelection: true, defaultValue: ["right"] } },
  },
  { name: "vertical", cfg: { root: { orientation: "vertical" } } },
]

// Every prop the machine reads, as the component receives it.
const propsOf = (cfg: Cfg) => ({
  collection: collectionOf(cfg.disabled),
  strategy: "roving",
  ids: { list: "root", item: (k: string) => `item-${k}` },
  loop: true,
  selectionMode: cfg.root?.selectionMode ?? "single",
  disallowEmptySelection: cfg.root?.disallowEmptySelection ?? false,
  focusableWhenDisabled: false,
  value: undefined,
  defaultValue: cfg.root?.defaultValue,
  onValueChange: undefined,
  disabled: false,
})

for (const { name, cfg } of configs) {
  describe(`toggle group model: ${name}`, () => {
    testMachine(toggleGroupContract, {
      test: it,
      setup: () => {
        toggleGroupArgs.current = { key: "right", label: "Right" }
        return render(<Align cfg={cfg} />)
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
  testMachine(toggleGroupContract, {
    test: (n, fn) => tests.push({ name: n, fn }),
    setup: () => {
      toggleGroupArgs.current = { key: "right", label: "Right" }
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

const broken = (item: (i: (typeof ITEMS)[number], index: number) => ReactElement) => () => (
  <>
    <ToggleGroup.Root aria-label="Alignment">{ITEMS.map(item)}</ToggleGroup.Root>
    <button type="button">After</button>
  </>
)

describe("broken Toggle Groups fail readably (5.2)", () => {
  it("radio roles in single mode", { timeout: 60_000 }, async () => {
    const out = await failures(
      broken((i) => (
        <ToggleGroup.Item key={i.value} value={i.value} role="radio">
          {i.label}
        </ToggleGroup.Item>
      )),
    )
    expect(out).toMatch(/anchor|role|no element/i)
  })

  it("arrows that press", { timeout: 60_000 }, async () => {
    const out = await failures(
      broken((i) => (
        <ToggleGroup.Item
          key={i.value}
          value={i.value}
          // Broken: an arrow presses the item it lands on.
          onFocus={(e) => {
            if (e.currentTarget.getAttribute("aria-pressed") === "false") e.currentTarget.click()
          }}
        >
          {i.label}
        </ToggleGroup.Item>
      )),
    )
    expect(out).toMatch(/toggle-group-aria-pressed/)
  })

  it("aria-pressed missing when off", { timeout: 60_000 }, async () => {
    const out = await failures(
      broken((i) => (
        <ToggleGroup.Item
          key={i.value}
          value={i.value}
          render={(p) => (
            <button {...p} aria-pressed={p["aria-pressed"] === "true" ? "true" : undefined} />
          )}
        >
          {i.label}
        </ToggleGroup.Item>
      )),
    )
    expect(out).toMatch(/toggle-group-aria-pressed: .* has no explicit aria-pressed/)
  })

  it("the root as tab stop", { timeout: 60_000 }, async () => {
    const out = await failures(() => (
      <>
        <ToggleGroup.Root aria-label="Alignment" tabIndex={0}>
          {ITEMS.map((i) => (
            <ToggleGroup.Item key={i.value} value={i.value} tabIndex={-1}>
              {i.label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
        <button type="button">After</button>
      </>
    ))
    expect(out).toMatch(/toggle-group-item-tab-stop: the root is a tab stop/)
  })
})
