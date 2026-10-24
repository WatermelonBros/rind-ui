// The Navigation Menu contract model (React's configurations: closed content hidden and
// unmounted, click only, nested levels, right to left, per-item positioners) against the
// Svelte parts, and DOM parity (in place and through a shared Viewport).
import {
  anchoredNavigationMenuContract,
  navigationMenuArgs,
  navigationMenuContract,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine, virtualClock } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { type ReactElement, createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import Menu from "../../fixtures/navigation-menu/menu.svelte"
import { clientParity } from "../../fixtures/parity"

const clock = virtualClock()
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
interface Cfg {
  readonly root?: Record<string, unknown>
  readonly nested?: boolean
  readonly dir?: "ltr" | "rtl"
  readonly positioned?: boolean
  /** One shared Viewport (in a Positioner) the open content renders into. */
  readonly viewport?: boolean
}
const reactMenu = (cfg: Cfg) => {
  const place = (content: ReactElement) =>
    cfg.positioned ? r(R.NavigationMenu.Positioner, null, content) : content
  return r(
    R.NavigationMenu.Root,
    { openDelay: 200, closeDelay: 100, ...cfg.root },
    r(
      R.NavigationMenu.List,
      null,
      r(
        R.NavigationMenu.Item,
        { value: "products" },
        r(R.NavigationMenu.Trigger, null, "Products"),
        place(
          r(
            R.NavigationMenu.Content,
            null,
            r(R.NavigationMenu.Link, { href: "#analytics" }, "Analytics"),
            r(R.NavigationMenu.Link, { href: "#engage" }, "Engage"),
            cfg.nested
              ? r(
                  R.NavigationMenu.Sub,
                  null,
                  r(
                    R.NavigationMenu.List,
                    null,
                    r(
                      R.NavigationMenu.Item,
                      { value: "more" },
                      r(R.NavigationMenu.Trigger, null, "More"),
                      r(
                        R.NavigationMenu.Content,
                        null,
                        r(R.NavigationMenu.Link, { href: "#labs" }, "Labs"),
                      ),
                    ),
                  ),
                )
              : null,
          ),
        ),
      ),
      r(
        R.NavigationMenu.Item,
        { value: "pricing" },
        r(R.NavigationMenu.Link, { href: "#pricing" }, "Pricing"),
      ),
      cfg.viewport ? r(R.NavigationMenu.Indicator) : null,
    ),
    cfg.viewport ? r(R.NavigationMenu.Positioner, null, r(R.NavigationMenu.Viewport)) : null,
  )
}
const configs: { name: string; cfg: Cfg }[] = [
  { name: "hidden content", cfg: {} },
  { name: "unmounted content", cfg: { root: { closedContent: "unmount" } } },
  { name: "click only", cfg: { root: { openOnHover: false } } },
  { name: "nested levels", cfg: { nested: true } },
  { name: "nested levels, unmounted", cfg: { nested: true, root: { closedContent: "unmount" } } },
  { name: "right to left", cfg: { dir: "rtl" } },
  { name: "positioned", cfg: { positioned: true } },
]
for (const { name, cfg } of configs) {
  const root = cfg.root ?? {}
  describe(`svelte navigation menu model: ${name}`, () => {
    testMachine(cfg.positioned ? anchoredNavigationMenuContract : navigationMenuContract, {
      test: it,
      setup: () => {
        navigationMenuArgs.current = { item: "Products", link: "Analytics" }
        return mount(Menu, { ...cfg, scheduler: clock.scheduler } as never)
      },
      target: () => screen,
      anchor: [{ name: "Main" }] as never,
      // `root` is internal (set by NavigationMenu.Root); the oracle only needs a value.
      props: {
        root: "oracle",
        value: undefined,
        disabled: undefined,
        openDelay: 200,
        closeDelay: 100,
        openOnHover: root["openOnHover"],
        isItemDisabled: () => false,
        patientClick: 500,
        positioned: cfg.positioned ? "item" : undefined,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      clock,
      a11y,
    })
  })
}

describe("Svelte Navigation Menu matches React", () => {
  it("closed, open in place, nested, per-item positioner, shared viewport", async () => {
    for (const cfg of [
      {},
      { root: { defaultValue: "products", id: "nav" } },
      { root: { closedContent: "unmount" } },
      { nested: true, root: { defaultValue: "products", id: "nav" } },
      { positioned: true, root: { defaultValue: "products", id: "nav" } },
      { viewport: true, root: { defaultValue: "products", id: "nav" } },
    ] as Cfg[]) {
      await clientParity(reactMenu(cfg), Menu, cfg as never)
    }
  })
})
