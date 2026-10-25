// The Context Menu contract model (React's: modal and non-modal, every opening path, long
// presses on a virtual clock) against the Angular parts, and markup parity.
import { Component } from "@angular/core"
import {
  contextMenuContract,
  createListCollection,
  menuArgs,
  nonModalContextMenuContract,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine, virtualClock } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { Menu } from "../menu/menu"
import { RindProvider } from "../provider"
import { ContextMenu } from "./context-menu"

// The long press runs on this clock: no test waits for elapsed time.
const clock = virtualClock()
const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const ITEMS = [
  { key: "rename", label: "Rename" },
  { key: "delete", label: "Delete" },
]
interface P {
  readonly modal?: boolean
  readonly disabled?: boolean
  readonly longPress?: boolean
}
/** The configuration the next fixture renders. */
let current: { p: P; clock: boolean } = { p: {}, clock: false }

const TREE = `<div id="app">
      <ng-container
        rindContextMenuRoot
        [modal]="p.modal ?? true"
        [disabled]="p.disabled ?? false"
        [longPress]="p.longPress ?? true"
      >
        <!-- A focusable region: the context-menu key needs focus inside it. -->
        <div rindContextMenuTrigger tabindex="0" style="width: 240px; height: 80px">
          <button type="button">README.md</button>
        </div>
        <ng-template rindMenuPortal>
          <div rindMenuPositioner>
            <div rindMenuContent aria-label="File actions">
              @for (i of items; track i.key) {
                <div rindMenuItem [value]="i.key">{{ i.label }}</div>
              }
            </div>
          </div>
        </ng-template>
      </ng-container>
      <button type="button">After</button>
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, ContextMenu, Menu],
  template: `@if (clock) {
      <ng-container rindProvider [environment]="env">${TREE}</ng-container>
    } @else {
      ${TREE}
    }`,
})
class Tree {
  readonly p = current.p
  readonly clock = current.clock
  readonly env = { scheduler: clock.scheduler }
  readonly items = ITEMS
}

const reactTree = (p: P) =>
  r(
    "div",
    { id: "app" },
    r(
      R.ContextMenu.Root,
      p,
      r(
        R.ContextMenu.Trigger,
        { tabIndex: 0, style: { width: 240, height: 80 } },
        r("button", { type: "button" }, "README.md"),
      ),
      r(
        R.Menu.Portal,
        null,
        r(
          R.Menu.Positioner,
          null,
          r(
            R.Menu.Content,
            { "aria-label": "File actions" },
            ITEMS.map((i) => r(R.Menu.Item, { key: i.key, value: i.key }, i.label)),
          ),
        ),
      ),
    ),
    r("button", { type: "button" }, "After"),
  )

const collection = createListCollection({
  items: ITEMS,
  getKey: (i) => i.key,
  getText: (i) => i.label,
})
const classes = [
  { name: "modal", modal: true, longPress: true },
  { name: "non-modal", modal: false, longPress: true },
] as const
for (const c of classes) {
  describe(`angular context menu model: ${c.name}`, () => {
    menuArgs.current = { key: "delete", label: "Delete" }
    testMachine(c.modal ? contextMenuContract : nonModalContextMenuContract, {
      test: it,
      setup: () => {
        current = { p: { modal: c.modal, longPress: c.longPress }, clock: true }
        return mount(Tree)
      },
      target: () => domEnv({ advanceClock: (ms) => clock.advance(ms) }),
      clock,
      anchor: [{ text: "README.md" }] as never,
      // Internal props (set by the Root); the oracle only needs values.
      props: {
        open: undefined,
        modal: c.modal,
        loop: true,
        level: "root",
        levelId: "oracle",
        region: true,
        collection,
        strategy: "roving",
        ids: { list: "oracle-content", item: (k: string) => `oracle-${k}` },
        focusableWhenDisabled: true,
        getTrigger: () => null,
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
      a11y,
    })
  })
}

describe("Angular Context Menu matches React", () => {
  for (const p of [{}, { disabled: true }, { longPress: false }] as P[]) {
    it(`closed ${JSON.stringify(p)}`, async () => {
      current = { p, clock: false }
      await both(reactTree(p), Tree)
    })
  }
})
