/** @jsxImportSource solid-js */
// The Menubar contract model (React's argument classes: horizontal, vertical, loop false, a
// disabled item, a disabled menubar, non-modal) against the Solid parts, and markup parity.
import { createListCollection, menubarArgs, menubarContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { Menu, Menubar, type MenubarRootProps, RindProvider } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
interface Cfg {
  readonly root?: Record<string, unknown>
  readonly disabled?: readonly string[]
}
const MENUS = { File: ["New", "Open"], Edit: ["Undo", "Redo"], View: ["Zoom in", "Zoom out"] }

const bar = (cfg: Cfg): JSX.Element => (
  <Menubar.Root aria-label="Application" {...(cfg.root as Partial<MenubarRootProps>)}>
    <For each={Object.entries(MENUS)}>
      {([label, items]) => (
        <Menubar.Menu value={label} disabled={cfg.disabled?.includes(label) ?? false}>
          <Menubar.Trigger>{label}</Menubar.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Content>
                <For each={items}>{(i) => <Menu.Item value={i}>{i}</Menu.Item>}</For>
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Portal>
        </Menubar.Menu>
      )}
    </For>
  </Menubar.Root>
)
const reactBar = (cfg: Cfg) =>
  r(
    R.Menubar.Root,
    { "aria-label": "Application", ...cfg.root },
    Object.entries(MENUS).map(([label, items]) =>
      r(
        R.Menubar.Menu,
        { key: label, value: label, disabled: cfg.disabled?.includes(label) ?? false },
        r(R.Menubar.Trigger, null, label),
        r(
          R.Menu.Portal,
          null,
          r(
            R.Menu.Positioner,
            null,
            r(
              R.Menu.Content,
              null,
              items.map((i) => r(R.Menu.Item, { key: i, value: i }, i)),
            ),
          ),
        ),
      ),
    ),
  )
const configs: { name: string; cfg: Cfg }[] = [
  { name: "horizontal", cfg: {} },
  { name: "vertical", cfg: { root: { orientation: "vertical" } } },
  { name: "loop false", cfg: { root: { loop: false } } },
  { name: "a disabled item", cfg: { disabled: ["Edit"] } },
  { name: "disabled menubar", cfg: { root: { disabled: true } } },
  { name: "non-modal", cfg: { root: { modal: false } } },
]
// Every prop the machine reads, as the component receives it.
const propsOf = (cfg: Cfg) => ({
  collection: createListCollection({
    items: Object.keys(MENUS),
    getKey: (l) => l,
    getText: (l) => l,
    isDisabled: (l) => cfg.disabled?.includes(l) === true,
  }),
  strategy: "roving",
  ids: { list: "root", item: (k: string) => k },
  loop: (cfg.root?.["loop"] as boolean | undefined) ?? true,
  focusableWhenDisabled: true,
  orientation: (cfg.root?.["orientation"] as string | undefined) ?? "horizontal",
  modal: (cfg.root?.["modal"] as boolean | undefined) ?? true,
  disabled: (cfg.root?.["disabled"] as boolean | undefined) ?? false,
  menus: { open: () => {}, close: () => {} },
})
for (const { name, cfg } of configs) {
  describe(`solid menubar model: ${name}`, () => {
    testMachine(menubarContract, {
      test: it,
      setup: () => {
        menubarArgs.current = { label: "File", other: "View" }
        return mount(() => (
          <RindProvider
            environment={{ platform: currentRun()?.platform ?? platforms.linux }}
            dir={currentRun()?.direction ?? "ltr"}
          >
            <button type="button">Before</button>
            {bar(cfg)}
            <button type="button">After</button>
          </RindProvider>
        ))
      },
      target: () => screen,
      anchor: [{ name: "Application" }] as never,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

describe("Solid Menubar matches React", () => {
  it("horizontal, vertical, disabled, an open menu", async () => {
    for (const cfg of [
      {},
      { root: { orientation: "vertical" } },
      { disabled: ["Edit"] },
      { root: { disabled: true } },
      { root: { defaultValue: "File", id: "app" } },
    ] as Cfg[]) {
      await clientParity(reactBar(cfg), () => bar(cfg))
    }
  })
})
