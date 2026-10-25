// The Navigation Menu contract model (React's configurations: closed content hidden and
// unmounted, click only, nested levels, right to left, per-item positioners) against the
// Angular parts, and markup parity (in place and through a shared Viewport).
import { Component } from "@angular/core"
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
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { NavigationMenu } from "./navigation-menu"

const clock = virtualClock()
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
interface Root {
  readonly closedContent?: "hidden" | "unmount"
  readonly openOnHover?: boolean
  readonly defaultValue?: string
  readonly id?: string
}
interface Cfg {
  readonly root?: Root
  readonly nested?: boolean
  readonly dir?: "ltr" | "rtl"
  readonly positioned?: boolean
  /** One shared Viewport (in a Positioner) the open content renders into. */
  readonly viewport?: boolean
}
/** The configuration the next fixture renders. */
let current: { cfg: Cfg; example: boolean } = { cfg: {}, example: false }

const CONTENT = `<div rindNavigationMenuContent>
              <a rindNavigationMenuLink href="#analytics">Analytics</a>
              <a rindNavigationMenuLink href="#engage">Engage</a>
              @if (cfg.nested) {
                <div rindNavigationMenuSub>
                  <ul rindNavigationMenuList>
                    <li rindNavigationMenuItem value="more">
                      <button rindNavigationMenuTrigger>More</button>
                      <div rindNavigationMenuContent>
                        <a rindNavigationMenuLink href="#labs">Labs</a>
                      </div>
                    </li>
                  </ul>
                </div>
              }
            </div>`
const MENU = `<nav
      rindNavigationMenuRoot
      [openDelay]="200"
      [closeDelay]="100"
      [closedContent]="root.closedContent ?? 'hidden'"
      [openOnHover]="root.openOnHover"
      [defaultValue]="root.defaultValue"
      [id]="root.id"
    >
      <ul rindNavigationMenuList>
        <li rindNavigationMenuItem value="products">
          <button rindNavigationMenuTrigger>Products</button>
          @if (cfg.positioned) {
            <div rindNavigationMenuPositioner>${CONTENT}</div>
          } @else {
            ${CONTENT}
          }
        </li>
        <li rindNavigationMenuItem value="pricing">
          <a rindNavigationMenuLink href="#pricing">Pricing</a>
        </li>
        @if (cfg.viewport) {
          <li rindNavigationMenuIndicator></li>
        }
      </ul>
      @if (cfg.viewport) {
        <div rindNavigationMenuPositioner><div rindNavigationMenuViewport></div></div>
      }
    </nav>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, NavigationMenu],
  template: `@if (example) {
      <ng-container rindProvider [environment]="env" [dir]="dir">
        <div [attr.dir]="dir">
          <a href="/before">Before</a>
          ${MENU}
          <a href="/after">After</a>
        </div>
      </ng-container>
    } @else {
      ${MENU}
    }`,
})
class Menu {
  readonly cfg = current.cfg
  readonly root = current.cfg.root ?? {}
  readonly example = current.example
  readonly env = { scheduler: clock.scheduler }
  readonly dir = current.cfg.dir ?? "ltr"
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
  describe(`angular navigation menu model: ${name}`, () => {
    testMachine(cfg.positioned ? anchoredNavigationMenuContract : navigationMenuContract, {
      test: it,
      setup: () => {
        navigationMenuArgs.current = { item: "Products", link: "Analytics" }
        current = { cfg, example: true }
        return mount(Menu)
      },
      target: () => screen,
      anchor: [{ name: "Main" }] as never,
      // `root` is internal (set by the Root); the oracle only needs a value.
      props: {
        root: "oracle",
        value: undefined,
        disabled: undefined,
        openDelay: 200,
        closeDelay: 100,
        openOnHover: root.openOnHover,
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

describe("Angular Navigation Menu matches React", () => {
  for (const cfg of [
    {},
    { root: { defaultValue: "products", id: "nav" } },
    { root: { closedContent: "unmount" } },
    { nested: true, root: { defaultValue: "products", id: "nav" } },
    { positioned: true, root: { defaultValue: "products", id: "nav" } },
    { viewport: true, root: { defaultValue: "products", id: "nav" } },
  ] as Cfg[]) {
    it(JSON.stringify(cfg), async () => {
      current = { cfg, example: false }
      await both(reactMenu(cfg), Menu)
    })
  }
})
