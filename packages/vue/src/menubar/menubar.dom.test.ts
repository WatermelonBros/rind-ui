// The Menubar contract model (React's argument classes: horizontal, vertical, loop false, a
// disabled item, a disabled menubar, non-modal) against the Vue parts, and markup parity.
import { createListCollection, menubarArgs, menubarContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { h } from "vue"
import { mount } from "../../fixtures/mount"
import { clientParity, serverParity } from "../../fixtures/parity"
import { Menu, Menubar, RindProvider } from "../index"

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

const bar = (cfg: Cfg) =>
  h(Menubar.Root, { "aria-label": "Application", ...cfg.root }, () =>
    Object.entries(MENUS).map(([label, items]) =>
      h(
        Menubar.Menu,
        { key: label, value: label, disabled: cfg.disabled?.includes(label) ?? false },
        () => [
          h(Menubar.Trigger, null, () => label),
          h(Menu.Portal, null, () =>
            h(Menu.Positioner, null, () =>
              h(Menu.Content, null, () =>
                items.map((i) => h(Menu.Item, { key: i, value: i }, () => i)),
              ),
            ),
          ),
        ],
      ),
    ),
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
  describe(`vue menubar model: ${name}`, () => {
    testMachine(menubarContract, {
      test: it,
      setup: () => {
        menubarArgs.current = { label: "File", other: "View" }
        return mount(() =>
          h(
            RindProvider,
            {
              environment: { platform: currentRun()?.platform ?? platforms.linux },
              dir: currentRun()?.direction ?? "ltr",
            },
            () => [
              h("button", { type: "button" }, "Before"),
              bar(cfg),
              h("button", { type: "button" }, "After"),
            ],
          ),
        )
      },
      target: () => screen,
      anchor: [{ name: "Application" }] as never,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

describe("Vue Menubar matches React", () => {
  it("horizontal, vertical, disabled, an open menu", async () => {
    for (const cfg of [
      {},
      { root: { orientation: "vertical" } },
      { disabled: ["Edit"] },
      { root: { disabled: true } },
      { root: { defaultValue: "File", id: "app" } },
    ] as Cfg[]) {
      await serverParity(reactBar(cfg), () => bar(cfg))
      await clientParity(reactBar(cfg), () => bar(cfg))
    }
  })
})
