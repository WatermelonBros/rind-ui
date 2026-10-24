// The Sortable contract model (React's: pick up, move, drop, cancel and quick moves by
// keyboard) against the Angular parts, and markup parity.
import { Component, signal } from "@angular/core"
import { type SortableOrientation, sortableContract, sortableMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Sortable } from "./sortable"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const LABELS: Record<string, string> = { apple: "Apple", banana: "Banana", cherry: "Cherry" }
const KEYS = ["apple", "banana", "cherry"]
interface P {
  readonly orientation?: SortableOrientation
  readonly handle?: boolean
}
/** The configuration the next fixture renders. */
let current: P = {}

@Component({
  selector: "rind-f",
  imports: [RindProvider, Sortable],
  template: `<ng-container rindProvider>
    <ul
      rindSortableRoot
      aria-label="Fruits"
      [items]="items()"
      [orientation]="p.orientation ?? 'vertical'"
      [handle]="p.handle ?? true"
      (reorder)="items.set($event.keys)"
    >
      @for (k of items(); track k) {
        <li rindSortableItem [value]="k">
          <button rindSortableHandle></button>
          <span>{{ labels[k] }}</span>
          <button rindSortableMoveButton direction="up"></button>
          <button rindSortableMoveButton direction="down"></button>
        </li>
      }
    </ul>
  </ng-container>`,
})
class Fruits {
  readonly p = current
  readonly labels = LABELS
  readonly items = signal<readonly string[]>(KEYS)
}
const reactList = (items: readonly string[], p: Record<string, unknown> = {}) =>
  r(
    R.Sortable.Root,
    { "aria-label": "Fruits", items, ...p },
    items.map((k) =>
      r(
        R.Sortable.Item,
        { key: k, value: k },
        r(R.Sortable.Handle),
        r("span", null, LABELS[k]),
        r(R.Sortable.MoveButton, { direction: "up" }),
        r(R.Sortable.MoveButton, { direction: "down" }),
      ),
    ),
  )

describe("angular sortable model", () => {
  testMachine(sortableContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () => {
      current = {}
      return mount(Fruits)
    },
    target: () => domEnv({ timeout: 200 }),
    anchor: [{ name: "Fruits" }],
    props: {
      id: "oracle",
      items: KEYS,
      labels: new Map(Object.entries(LABELS)),
      disabledKeys: new Set<string>(),
      messages: sortableMessages,
    } as never,
    // Picking up is a keyboard act (a pointer drags): the pointer paths are the DOM tests.
    modalities: ["keyboard"],
    a11y,
  } as never)
})

describe("Angular Sortable matches React", () => {
  it("vertical, horizontal, handle-free", async () => {
    for (const p of [{}, { orientation: "horizontal" }, { handle: false }] as P[]) {
      current = p
      await both(reactList(KEYS, p as Record<string, unknown>), Fruits)
    }
  })
})
