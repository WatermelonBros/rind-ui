// The Menubar contract model (React's argument classes: horizontal, vertical, loop false, a
// disabled item, a disabled menubar, non-modal) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
import { createListCollection, menubarArgs, menubarContract, platforms } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Menu } from "../menu/menu"
import { RindProvider } from "../provider"
import { Menubar } from "./menubar"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
interface Root {
  readonly orientation?: "horizontal" | "vertical"
  readonly loop?: boolean
  readonly modal?: boolean
  readonly disabled?: boolean
  readonly defaultValue?: string
  readonly id?: string
}
interface Cfg {
  readonly root?: Root
  readonly disabled?: readonly string[]
}
const MENUS = { File: ["New", "Open"], Edit: ["Undo", "Redo"], View: ["Zoom in", "Zoom out"] }
/** The configuration the next fixture renders. */
let current: { cfg: Cfg; provider: boolean } = { cfg: {}, provider: false }

const BAR = `<div
      rindMenubarRoot
      aria-label="Application"
      [orientation]="root.orientation ?? 'horizontal'"
      [loop]="root.loop ?? true"
      [modal]="root.modal ?? true"
      [disabled]="root.disabled ?? false"
      [defaultValue]="root.defaultValue"
      [id]="root.id"
    >
      @for (m of menus; track m.label) {
        <ng-container rindMenubarMenu [value]="m.label" [disabled]="m.disabled">
          <div rindMenubarTrigger>{{ m.label }}</div>
          <ng-template rindMenuPortal>
            <div rindMenuPositioner>
              <div rindMenuContent>
                @for (i of m.items; track i) {
                  <div rindMenuItem [value]="i">{{ i }}</div>
                }
              </div>
            </div>
          </ng-template>
        </ng-container>
      }
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Menubar, Menu],
  template: `@if (provider) {
      <ng-container rindProvider [environment]="env" [dir]="dir">
        <button type="button">Before</button>
        ${BAR}
        <button type="button">After</button>
      </ng-container>
    } @else {
      ${BAR}
    }`,
})
class Bar {
  readonly root = current.cfg.root ?? {}
  readonly provider = current.provider
  readonly menus = Object.entries(MENUS).map(([label, items]) => ({
    label,
    items,
    disabled: current.cfg.disabled?.includes(label) ?? false,
  }))
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly dir = currentRun()?.direction ?? "ltr"
}

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
  loop: cfg.root?.loop ?? true,
  focusableWhenDisabled: true,
  orientation: cfg.root?.orientation ?? "horizontal",
  modal: cfg.root?.modal ?? true,
  disabled: cfg.root?.disabled ?? false,
  menus: { open: () => {}, close: () => {} },
})
for (const { name, cfg } of configs) {
  describe(`angular menubar model: ${name}`, () => {
    testMachine(menubarContract, {
      test: it,
      setup: () => {
        menubarArgs.current = { label: "File", other: "View" }
        current = { cfg, provider: true }
        return mount(Bar)
      },
      target: () => screen,
      anchor: [{ name: "Application" }] as never,
      props: propsOf(cfg) as never,
      a11y,
    })
  })
}

describe("Angular Menubar matches React", () => {
  for (const cfg of [
    {},
    { root: { orientation: "vertical" } },
    { disabled: ["Edit"] },
    { root: { disabled: true } },
    { root: { defaultValue: "File", id: "app" } },
  ] as Cfg[]) {
    it(JSON.stringify(cfg), async () => {
      current = { cfg, provider: false }
      await both(reactBar(cfg), Bar)
    })
  }
})
