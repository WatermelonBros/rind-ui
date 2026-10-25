// The Tag Group contract model (React's matrix) against the Angular parts, and markup parity
// (data tags, static tags, links, selection).
import { Component } from "@angular/core"
import {
  createListCollection,
  platforms,
  type TagGroupProps,
  tagGroupContract,
  tagGroupIds,
  tagGroupTraits,
} from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { currentRun, testMachine } from "@rind-ui/testing"
import { screen } from "@testing-library/dom"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { both, clientParity } from "../../fixtures/parity"
import { RindProvider } from "../provider"
import { TagGroup } from "./tag-group"

type Item = {
  readonly key: string
  readonly label: string
  readonly disabled?: boolean
  readonly href?: string
}
const CITIES: readonly Item[] = ["Rome", "Paris", "Oslo", "Lima"].map((label) => ({
  key: label.toLowerCase(),
  label,
}))
const itemsOf = (items: readonly Item[]) =>
  createListCollection({
    items,
    getKey: (i) => i.key,
    getText: (i) => i.label,
    isDisabled: (i) => i.disabled === true,
  })
type Config = Pick<TagGroupProps, "selectionMode"> & {
  readonly items?: readonly Item[]
  readonly removable?: boolean
  readonly actions?: boolean
}
type Root = Record<string, unknown>
/** The configuration the next fixture renders. */
let current: { items: readonly Item[]; root: Root; around: boolean } = {
  items: CITIES,
  root: {},
  around: false,
}

const GROUP = `<div
      rindTagGroupRoot
      #g="rindTagGroupRoot"
      [items]="items"
      [selectionMode]="$any(root['selectionMode']) ?? 'none'"
      [defaultValue]="$any(root['defaultValue'])"
      [onRemove]="$any(root['onRemove'])"
      [onAction]="$any(root['onAction'])"
    >
      <span rindTagGroupLabel>Cities</span>
      <div rindTagGroupList>
        @for (t of g.tags(); track t.key) {
          <div rindTagGroupTag [value]="t.key" [textValue]="t.label" [disabled]="t.disabled">
            @if (t.href) {
              <a rindTagGroupTagText>{{ t.label }}</a>
            } @else {
              <span rindTagGroupTagText>{{ t.label }}</span>
            }
            <button rindTagGroupTagRemove></button>
          </div>
        }
        <div rindTagGroupEmpty>No cities</div>
      </div>
    </div>`

@Component({
  selector: "rind-f",
  imports: [RindProvider, TagGroup],
  template: `@if (around) {
      <ng-container rindProvider [environment]="env" [dir]="dir">
        ${GROUP}<button type="button">After</button>
      </ng-container>
    } @else {
      ${GROUP}
    }`,
})
class Tree {
  readonly env = { platform: currentRun()?.platform ?? platforms.linux }
  readonly dir = currentRun()?.direction === "rtl" ? "rtl" : "ltr"
  readonly items = current.items
  readonly root = current.root
  readonly around = current.around
}
const reactGroup = (items: readonly Item[], root: Root) =>
  r(
    R.TagGroup.Root,
    { items, ...root } as never,
    r(R.TagGroup.Label, null, "Cities"),
    r(R.TagGroup.List, null, r(R.TagGroup.Tags), r(R.TagGroup.Empty, null, "No cities")),
  )
const rootOf = (cfg: Config) => ({
  selectionMode: cfg.selectionMode ?? "none",
  ...(cfg.removable ? { onRemove: () => {} } : {}),
  ...(cfg.actions ? { onAction: () => {} } : {}),
})

function config(name: string, cfg: Config) {
  const contract = {
    ...tagGroupContract,
    traits: tagGroupTraits(cfg),
  } as unknown as typeof tagGroupContract
  const items = cfg.items ?? CITIES
  describe(`angular tag group model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () => {
        current = { items, root: rootOf(cfg), around: true }
        return mount(Tree)
      },
      target: () => screen,
      anchor: [{ name: "Cities" }],
      props: {
        collection: itemsOf(items),
        ids: tagGroupIds("oracle"),
        instance: "oracle",
        strategy: "roving",
        selectionMode: cfg.selectionMode ?? "none",
        focusableWhenDisabled: true,
        loop: true,
        ...(cfg.removable ? { onRemove: () => {} } : {}),
        ...(cfg.actions ? { onAction: () => {} } : {}),
        links: new Set(items.filter((i) => i.href !== undefined).map((i) => i.key)),
      } as never,
      modalities: ["pointer", "keyboard", "touch", "virtual"],
    } as never)
  })
}
config("removable", { removable: true })
config("selectable single", { selectionMode: "single" })
config("selectable multiple", { selectionMode: "multiple" })
config("selectable and removable", { selectionMode: "multiple", removable: true })
config("actions", { actions: true })
config("disabled tags", {
  removable: true,
  items: CITIES.map((c) => (c.key === "paris" ? { ...c, disabled: true } : c)),
})
config("empty", { removable: true, items: [] })
config("links", { items: CITIES.map((c) => ({ ...c, href: `#${c.key}` })) })

@Component({
  selector: "rind-f",
  imports: [TagGroup],
  template: `<div rindTagGroupRoot selectionMode="single">
    <span rindTagGroupLabel>Fruit</span>
    <div rindTagGroupList>
      @for (t of fruit; track t) {
        <div rindTagGroupTag [value]="t.toLowerCase()"><span rindTagGroupTagText>{{ t }}</span></div>
      }
    </div>
  </div>`,
})
class Static {
  readonly fruit = ["Apple", "Pear"]
}

describe("Angular Tag Group matches React", () => {
  it("removable, selected, links, empty; static tags", async () => {
    for (const [items, root] of [
      [CITIES, { onRemove: () => {} }],
      [CITIES, { selectionMode: "multiple", defaultValue: ["rome"] }],
      [CITIES.map((c) => ({ ...c, href: `#${c.key}` })), {}],
      [[], { onRemove: () => {} }],
    ] as const) {
      current = { items, root, around: false }
      await both(reactGroup(items, root), Tree)
    }
    await clientParity(
      r(
        R.TagGroup.Root,
        { selectionMode: "single" },
        r(R.TagGroup.Label, null, "Fruit"),
        r(
          R.TagGroup.List,
          null,
          ["Apple", "Pear"].map((t) =>
            r(R.TagGroup.Tag, { key: t, value: t.toLowerCase() }, r(R.TagGroup.TagText, null, t)),
          ),
        ),
      ),
      Static,
    )
  })
})
