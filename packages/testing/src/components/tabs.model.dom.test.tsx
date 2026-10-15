// Model-based tests (task 6.1): the Tabs contract over every transition in pointer, touch,
// keyboard and virtual, LTR and RTL, for the argument classes (no default, first disabled,
// selected disabled, all disabled, vertical, manual, until-found); broken variants (6.2).
import { createListCollection, platforms, tabsArgs, tabsContract } from "@rind-ui/core"
import { RindProvider, Tabs } from "@rind-ui/react"
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

const TABS = [
  { value: "general", label: "General" },
  { value: "billing", label: "Billing" },
  { value: "team", label: "Team" },
]
const anchor = [{ name: "Settings" }] as never

type RootProps = Parameters<typeof Tabs.Root>[0]
interface Cfg {
  readonly root?: Partial<RootProps>
  readonly disabled?: readonly string[]
}

const collectionOf = (disabled: readonly string[] = []) =>
  createListCollection({
    items: TABS,
    getKey: (i) => i.value,
    getText: (i) => i.label,
    isDisabled: (i) => disabled.includes(i.value),
  })

function Settings({ cfg }: { cfg: Cfg }) {
  return (
    <RindProvider
      environment={{ platform: currentRun()?.platform ?? platforms.linux }}
      dir={currentRun()?.direction ?? "ltr"}
    >
      <Tabs.Root {...cfg.root}>
        <Tabs.List aria-label="Settings">
          {TABS.map((t) => (
            <Tabs.Tab
              key={t.value}
              value={t.value}
              disabled={cfg.disabled?.includes(t.value) === true}
            >
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {TABS.map((t) => (
          <Tabs.Panel key={t.value} value={t.value}>
            {t.label} settings
          </Tabs.Panel>
        ))}
      </Tabs.Root>
      <button type="button">After</button>
    </RindProvider>
  )
}

const configs: { name: string; cfg: Cfg }[] = [
  { name: "no default", cfg: {} },
  { name: "first disabled", cfg: { disabled: ["general"] } },
  { name: "selected disabled", cfg: { root: { defaultValue: "billing" }, disabled: ["billing"] } },
  { name: "all disabled", cfg: { disabled: ["general", "billing", "team"] } },
  { name: "vertical", cfg: { root: { orientation: "vertical" } } },
  { name: "manual", cfg: { root: { activationMode: "manual" } } },
  { name: "until-found", cfg: { root: { inactivePanels: "until-found" } } },
]

// Every prop the machine reads, as the component receives it.
const propsOf = (cfg: Cfg) => ({
  collection: collectionOf(cfg.disabled),
  strategy: "roving",
  ids: { list: "list", item: (k: string) => `tab-${k}` },
  loop: true,
  focusableWhenDisabled: false,
  value: undefined,
  // The oracle never starts: the registration pick (INITIAL, the first enabled tab: covered
  // by the machine and DOM tests) is its starting value.
  defaultValue: cfg.root?.defaultValue ?? TABS.find((t) => !cfg.disabled?.includes(t.value))?.value,
  onValueChange: undefined,
  activationMode: cfg.root?.activationMode ?? "automatic",
  disabled: false,
})

for (const { name, cfg } of configs) {
  describe(`tabs model: ${name}`, () => {
    testMachine(tabsContract, {
      test: it,
      setup: () => {
        tabsArgs.current = { key: "team", label: "Team" }
        return render(<Settings cfg={cfg} />)
      },
      target: () => screen,
      anchor,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

/** Every failure of the contract run on a broken variant. */
async function failures(ui: () => ReactElement, cfg: Cfg = {}) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(tabsContract, {
    test: (n, fn) => tests.push({ name: n, fn }),
    setup: () => {
      tabsArgs.current = { key: "team", label: "Team" }
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

const broken =
  (
    tab: (t: (typeof TABS)[number]) => ReactElement,
    panel: (t: (typeof TABS)[number]) => ReactElement = (t) => (
      <Tabs.Panel key={t.value} value={t.value}>
        {t.label} settings
      </Tabs.Panel>
    ),
    root: Partial<RootProps> = {},
  ) =>
  () => (
    <>
      <Tabs.Root {...root}>
        <Tabs.List aria-label="Settings">{TABS.map(tab)}</Tabs.List>
        {TABS.map(panel)}
      </Tabs.Root>
      <button type="button">After</button>
    </>
  )

describe("broken Tabs fail readably (6.2)", () => {
  it("select on focus (radix#1047)", { timeout: 60_000 }, async () => {
    const out = await failures(
      broken((t) => (
        <Tabs.Tab
          key={t.value}
          value={t.value}
          // Broken: any focus selects.
          onFocus={(e) => {
            if (e.currentTarget.getAttribute("aria-selected") === "false") e.currentTarget.click()
          }}
        >
          {t.label}
        </Tabs.Tab>
      )),
    )
    expect(out).toMatch(/focus-does-not-commit|selectable|differ from the machine's value/)
  })

  it("tab stop on a disabled selected tab (react-spectrum#10633)", {
    timeout: 60_000,
  }, async () => {
    const cfg: Cfg = { root: { defaultValue: "general" }, disabled: ["general"] }
    const out = await failures(
      broken(
        (t) => (
          <Tabs.Tab
            key={t.value}
            value={t.value}
            disabled={t.value === "general"}
            // Broken: the disabled selected tab keeps the tab stop.
            render={(p) => <span {...p} tabIndex={t.value === "general" ? 0 : -1} />}
          >
            {t.label}
          </Tabs.Tab>
        ),
        undefined,
        { defaultValue: "general" },
      ),
      cfg,
    )
    expect(out).toMatch(/tab stop|tabindex|disabled/i)
  })

  it("panels hidden only visually (headlessui#2688)", { timeout: 60_000 }, async () => {
    const out = await failures(
      broken(
        (t) => (
          <Tabs.Tab key={t.value} value={t.value}>
            {t.label}
          </Tabs.Tab>
        ),
        (t) => (
          <Tabs.Panel
            key={t.value}
            value={t.value}
            render={(p) => (
              <div
                {...p}
                hidden={undefined}
                style={{ display: p["hidden"] ? "none" : undefined }}
              />
            )}
          >
            {t.label} settings
          </Tabs.Panel>
        ),
        { inactivePanels: "hidden" },
      ),
    )
    expect(out).toMatch(/tabs-panels: \d panels are visible/)
  })

  it("dangling aria-controls (radix#1703)", { timeout: 60_000 }, async () => {
    const out = await failures(
      broken((t) => (
        <Tabs.Tab key={t.value} value={t.value} aria-controls={`tabs-panel-${t.value}`}>
          {t.label}
        </Tabs.Tab>
      )),
    )
    expect(out).toMatch(
      /tabs-panels: .* controls a panel that is not rendered|idref|aria-controls/i,
    )
  })
})
