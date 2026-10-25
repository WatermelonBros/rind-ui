/** @jsxImportSource solid-js */
// The Navigation Menu contract model (React's configurations: closed content hidden and
// unmounted, click only, nested levels, right to left, per-item positioners) against the Solid
// parts, and markup parity (in place and through a shared Viewport).
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
import type { JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { NavigationMenu as N, RindProvider } from "../index"
import type { NavigationMenuRootProps } from "./navigation-menu"

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
const menu = (cfg: Cfg): JSX.Element => {
  const place = (content: () => JSX.Element) =>
    cfg.positioned ? <N.Positioner>{content()}</N.Positioner> : content()
  return (
    <N.Root openDelay={200} closeDelay={100} {...(cfg.root as Partial<NavigationMenuRootProps>)}>
      <N.List>
        <N.Item value="products">
          <N.Trigger>Products</N.Trigger>
          {place(() => (
            <N.Content>
              <N.Link href="#analytics">Analytics</N.Link>
              <N.Link href="#engage">Engage</N.Link>
              {cfg.nested ? (
                <N.Sub>
                  <N.List>
                    <N.Item value="more">
                      <N.Trigger>More</N.Trigger>
                      <N.Content>
                        <N.Link href="#labs">Labs</N.Link>
                      </N.Content>
                    </N.Item>
                  </N.List>
                </N.Sub>
              ) : null}
            </N.Content>
          ))}
        </N.Item>
        <N.Item value="pricing">
          <N.Link href="#pricing">Pricing</N.Link>
        </N.Item>
        {cfg.viewport ? <N.Indicator /> : null}
      </N.List>
      {cfg.viewport ? (
        <N.Positioner>
          <N.Viewport />
        </N.Positioner>
      ) : null}
    </N.Root>
  )
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
const example = (cfg: Cfg): JSX.Element => {
  const dir = cfg.dir ?? "ltr"
  return (
    <RindProvider environment={{ scheduler: clock.scheduler }} dir={dir}>
      <div dir={dir}>
        <a href="/before">Before</a>
        {menu(cfg)}
        <a href="/after">After</a>
      </div>
    </RindProvider>
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
  describe(`solid navigation menu model: ${name}`, () => {
    testMachine(cfg.positioned ? anchoredNavigationMenuContract : navigationMenuContract, {
      test: it,
      setup: () => {
        navigationMenuArgs.current = { item: "Products", link: "Analytics" }
        return mount(() => example(cfg))
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

describe("Solid Navigation Menu matches React", () => {
  it("closed, open in place, nested, per-item positioner, shared viewport", async () => {
    for (const cfg of [
      {},
      { root: { defaultValue: "products", id: "nav" } },
      { root: { closedContent: "unmount" } },
      { nested: true, root: { defaultValue: "products", id: "nav" } },
      { positioned: true, root: { defaultValue: "products", id: "nav" } },
      { viewport: true, root: { defaultValue: "products", id: "nav" } },
    ] as Cfg[]) {
      await clientParity(reactMenu(cfg), () => menu(cfg))
    }
  })
})
