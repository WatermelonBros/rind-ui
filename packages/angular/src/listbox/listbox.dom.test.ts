// The Listbox contract model (React's matrix) against the Angular parts, and markup parity
// (data items, sections, static items with descriptions and indicators, empty).
import { Component } from "@angular/core"
import {
  createListCollection,
  type ListboxProps,
  listboxContract,
  listboxIds,
  listboxTraits,
  platforms,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both, clientParity } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { Listbox } from "./listbox"

type Item = {
  key: string
  label: string
  disabled?: boolean
  section?: { key: string; label: string }
}
const FRUITS: Item[] = ["Apple", "Banana", "Cherry", "Date", "Elderberry"].map((label) => ({
  key: label.toLowerCase(),
  label,
}))
const itemsOf = (items: readonly Item[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
    getSection: (i) => i.section,
  })
type Config = Pick<
  ListboxProps,
  "selectionMode" | "selectionBehavior" | "orientation" | "loading"
> & { readonly items?: readonly Item[] }
type Root = Record<string, unknown>
/** The configuration the next fixture renders. */
let current: { items: readonly Item[]; root: Root; around: boolean } = {
  items: FRUITS,
  root: {},
  around: false,
}

const ITEM = `<div rindListboxItem [value]="i.key" [textValue]="i.label" [disabled]="i.disabled">
          <span rindListboxItemText>{{ i.label }}</span>
        </div>`
const LIST = `<ng-container
      rindListboxRoot
      #l="rindListboxRoot"
      [items]="items"
      [selectionMode]="$any(root['selectionMode']) ?? 'single'"
      [selectionBehavior]="$any(root['selectionBehavior']) ?? 'toggle'"
      [orientation]="$any(root['orientation']) ?? 'vertical'"
      [loading]="$any(root['loading'])"
      [defaultValue]="$any(root['defaultValue'])"
      [onAction]="$any(root['onAction'])"
    >
      <span rindListboxLabel>Fruit</span>
      <div rindListboxList>
        @for (g of l.groups(); track $index) {
          @if (g.section; as s) {
            <div rindListboxSection [section]="s">
              @for (i of g.items; track i.key) {
                ${ITEM}
              }
            </div>
          } @else {
            @for (i of g.items; track i.key) {
              ${ITEM}
            }
          }
        }
      </div>
    </ng-container>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, Listbox],
  template: `@if (around) {
      <ng-container rindProvider [environment]="env" [dir]="dir">
        ${LIST}<button type="button">After</button>
      </ng-container>
    } @else {
      ${LIST}
    }`,
})
class Tree {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly dir = currentRun()?.direction === "rtl" ? "rtl" : "ltr"
  readonly items = current.items
  readonly root = current.root
  readonly around = current.around
}
const reactList = (items: readonly Item[], root: Root) =>
  r(
    R.Listbox.Root,
    { items, ...root } as never,
    r(R.Listbox.Label, null, "Fruit"),
    r(R.Listbox.List, null, r(R.Listbox.Items)),
  )

function config(name: string, cfg: Config) {
  const horizontal = cfg.orientation === "horizontal"
  const contract = {
    ...listboxContract,
    traits: listboxTraits(cfg),
    actions: {
      ...listboxContract.actions,
      ...(horizontal
        ? {
            next: {
              ...listboxContract.actions.next,
              keyboard: (env: { keyboard(k: string): Promise<void> }) => env.keyboard("ArrowRight"),
            },
          }
        : {}),
    },
  } as unknown as typeof listboxContract
  const { items: _items, ...props } = cfg
  const root = {
    ...props,
    ...(cfg.selectionMode === "none" || cfg.selectionBehavior === "replace"
      ? { onAction: () => {} }
      : {}),
  }
  describe(`angular listbox model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => {
        current = { items: cfg.items ?? FRUITS, root, around: true }
        return mount(Tree)
      },
      target: () => screen,
      anchor: [{ name: "Fruit" }],
      props: {
        collection: itemsOf(cfg.items ?? FRUITS),
        loading: cfg.loading,
        ids: listboxIds("listbox", "oracle"),
        strategy: "roving",
        selectionMode: cfg.selectionMode ?? "single",
        selectionBehavior: cfg.selectionBehavior,
        orientation: cfg.orientation,
        onAction: () => {},
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
    } as never)
  })
}
config("single toggle", { selectionMode: "single" })
config("single replace", { selectionMode: "single", selectionBehavior: "replace" })
config("multiple toggle", { selectionMode: "multiple" })
config("multiple replace", { selectionMode: "multiple", selectionBehavior: "replace" })
config("none with onAction", { selectionMode: "none" })
config("horizontal (ltr and rtl)", { selectionMode: "single", orientation: "horizontal" })
config("sections", {
  selectionMode: "multiple",
  items: FRUITS.map((f, i) => ({
    ...f,
    section: i < 2 ? { key: "a", label: "First" } : { key: "b", label: "Second" },
  })),
})
config("disabled neighbour", {
  selectionMode: "multiple",
  items: FRUITS.map((f) => (f.key === "banana" ? { ...f, disabled: true } : f)),
})
config("empty", { selectionMode: "single", items: [] })
config("loading more (async)", { selectionMode: "single", loading: "loading-more" })

@Component({
  selector: "rind-f",
  imports: [Listbox],
  template: `<ng-container rindListboxRoot defaultValue="a">
    <span rindListboxLabel>Letters</span>
    <div rindListboxList>
      @for (k of keys; track k) {
        <div rindListboxItem [value]="k">
          <span rindListboxItemText>{{ k.toUpperCase() }}</span>
          <span rindListboxItemDescription>The letter {{ k }}</span>
          <span rindListboxItemIndicator>✓</span>
        </div>
      }
    </div>
    <div rindListboxEmpty>Nothing</div>
  </ng-container>`,
})
class Static {
  readonly keys = ["a", "b"]
}

describe("Angular Listbox matches React", () => {
  it("data, sections, selected, static parts, empty", async () => {
    for (const [items, root] of [
      [FRUITS, {}],
      [
        FRUITS.map((f, i) => ({
          ...f,
          section: i < 2 ? { key: "a", label: "First" } : { key: "b", label: "Second" },
        })),
        { selectionMode: "multiple" },
      ],
      [FRUITS, { defaultValue: "cherry" }],
      [[], {}],
    ] as const) {
      current = { items, root, around: false }
      await both(reactList(items, root), Tree)
    }
    await clientParity(
      r(
        R.Listbox.Root,
        { defaultValue: "a" },
        r(R.Listbox.Label, null, "Letters"),
        r(
          R.Listbox.List,
          null,
          ["a", "b"].map((k) =>
            r(
              R.Listbox.Item,
              { key: k, value: k },
              r(R.Listbox.ItemText, null, k.toUpperCase()),
              r(R.Listbox.ItemDescription, null, `The letter ${k}`),
              r(R.Listbox.ItemIndicator, null, "✓"),
            ),
          ),
        ),
        r(R.Listbox.Empty, null, "Nothing"),
      ),
      Static,
    )
  })
})
