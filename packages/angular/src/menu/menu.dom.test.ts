// The Menu contract model (React's: modal, non-modal and loop false, ltr and rtl) against the
// Angular parts, and markup parity (items, checkbox and radio items, groups, a link item).
import { Component } from "@angular/core"
import { createListCollection, menuArgs, menuContract, nonModalMenuContract } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Menu } from "./menu"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const ITEMS = [
  { key: "copy", label: "Copy" },
  { key: "paste", label: "Paste" },
]
interface P {
  readonly modal?: boolean
  readonly loop?: boolean
  readonly defaultOpen?: boolean
}
/** The configuration the next fixture renders. */
let current: P = {}

@Component({
  selector: "rind-f",
  imports: [Menu],
  template: `<div id="app">
    <ng-container rindMenuRoot [modal]="p.modal ?? true" [loop]="p.loop">
      <button rindMenuTrigger>Edit</button>
      <ng-template rindMenuPortal>
        <div rindMenuPositioner>
          <div rindMenuContent>
            @for (i of items; track i.key) {
              <div rindMenuItem [value]="i.key">{{ i.label }}</div>
            }
          </div>
        </div>
      </ng-template>
    </ng-container>
    <button type="button">After</button>
  </div>`,
})
class Example {
  readonly p = current
  readonly items = ITEMS
}

const collection = createListCollection({
  items: ITEMS,
  getKey: (i) => i.key,
  getText: (i) => i.label,
})
const classes = [
  { name: "modal", modal: true, loop: true },
  { name: "non-modal", modal: false, loop: true },
  { name: "loop: false", modal: true, loop: false },
] as const
for (const c of classes) {
  describe(`angular menu model: ${c.name}`, () => {
    menuArgs.current = { key: "paste", label: "Paste" }
    testMachine(c.modal ? menuContract : nonModalMenuContract, {
      test: it,
      setup: () => {
        current = { modal: c.modal, loop: c.loop }
        return mount(Example)
      },
      target: () => screen,
      anchor: [{ name: "Edit" }] as never,
      // Internal props (set by the Root); the oracle only needs values.
      props: {
        open: undefined,
        modal: c.modal,
        loop: c.loop,
        level: "root",
        levelId: "oracle",
        collection,
        strategy: "roving",
        ids: { list: "oracle-content", item: (k: string) => `oracle-${k}` },
        focusableWhenDisabled: true,
        getTrigger: () => null,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      directions: ["ltr", "rtl"],
      a11y,
    })
  })
}

// Everything else, in place (no portal), open.
@Component({
  selector: "rind-f",
  imports: [Menu],
  template: `<ng-container
    rindMenuRoot
    id="edit"
    [defaultOpen]="p.defaultOpen ?? true"
    [modal]="p.modal ?? true"
  >
    <button rindMenuTrigger>Edit</button>
    <div rindMenuPositioner>
      <div rindMenuContent>
        <div rindMenuItem value="copy"><span rindMenuItemText>Copy</span></div>
        <a rindMenuItem value="docs" href="/docs">Docs</a>
        <div rindMenuSeparator></div>
        <div rindMenuCheckboxItem value="wrap" defaultChecked>
          <span rindMenuItemIndicator>✓</span>Wrap
        </div>
        <div rindMenuGroup>
          <div rindMenuGroupLabel>Theme</div>
          <div rindMenuRadioGroup defaultValue="dark">
            <div rindMenuRadioItem value="light"><span rindMenuItemIndicator keepMounted></span>Light</div>
            <div rindMenuRadioItem value="dark"><span rindMenuItemIndicator keepMounted></span>Dark</div>
          </div>
        </div>
        <div rindMenuItem value="gone" disabled>Delete</div>
        <div rindMenuArrow></div>
      </div>
    </div>
  </ng-container>`,
})
class Full {
  readonly p = current
}

const reactFull = (p: P) =>
  r(
    R.Menu.Root,
    { defaultOpen: true, id: "edit", ...p },
    r(R.Menu.Trigger, null, "Edit"),
    r(
      R.Menu.Positioner,
      null,
      r(
        R.Menu.Content,
        null,
        r(R.Menu.Item, { value: "copy" }, r(R.Menu.ItemText, null, "Copy")),
        r(R.Menu.Item, { value: "docs", href: "/docs" }, "Docs"),
        r(R.Menu.Separator),
        r(
          R.Menu.CheckboxItem,
          { value: "wrap", defaultChecked: true },
          r(R.Menu.ItemIndicator, null, "✓"),
          "Wrap",
        ),
        r(
          R.Menu.Group,
          null,
          r(R.Menu.GroupLabel, null, "Theme"),
          r(
            R.Menu.RadioGroup,
            { defaultValue: "dark" },
            r(
              R.Menu.RadioItem,
              { value: "light" },
              r(R.Menu.ItemIndicator, { keepMounted: true }),
              "Light",
            ),
            r(
              R.Menu.RadioItem,
              { value: "dark" },
              r(R.Menu.ItemIndicator, { keepMounted: true }),
              "Dark",
            ),
          ),
        ),
        r(R.Menu.Item, { value: "gone", disabled: true }, "Delete"),
        r(R.Menu.Arrow),
      ),
    ),
  )

describe("Angular Menu matches React", () => {
  for (const p of [{ defaultOpen: false }, {}, { modal: false }] as P[]) {
    it(`items, link, checkbox, radio, group, separator ${JSON.stringify(p)}`, async () => {
      current = p
      await both(reactFull(p), Full)
    })
  }
})
