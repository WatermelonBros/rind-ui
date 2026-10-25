/** @jsxImportSource solid-js */
// The Tag Group contract model (React's matrix) against the Solid parts, and markup parity
// (data tags, static tags, links, selection).
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
import { For, type JSX } from "solid-js"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import { RindProvider, TagGroup, type TagGroupRootProps } from "../index"

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
const group = (items: readonly Item[], root: Record<string, unknown>): JSX.Element => (
  <TagGroup.Root items={items} {...(root as Partial<TagGroupRootProps>)}>
    <TagGroup.Label>Cities</TagGroup.Label>
    <TagGroup.List>
      <TagGroup.Tags />
      <TagGroup.Empty>No cities</TagGroup.Empty>
    </TagGroup.List>
  </TagGroup.Root>
)
const reactGroup = (items: readonly Item[], root: Record<string, unknown>) =>
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
  describe(`solid tag group model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () =>
        mount(() => (
          <RindProvider
            environment={{ platform: currentRun()?.platform ?? platforms.linux }}
            dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
          >
            {group(items, rootOf(cfg))}
            <button type="button">After</button>
          </RindProvider>
        )),
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

describe("Solid Tag Group matches React", () => {
  it("removable, selected, links, empty; static tags", async () => {
    for (const [items, root] of [
      [CITIES, { onRemove: () => {} }],
      [CITIES, { selectionMode: "multiple", defaultValue: ["rome"] }],
      [CITIES.map((c) => ({ ...c, href: `#${c.key}` })), {}],
      [[], { onRemove: () => {} }],
    ] as const) {
      await clientParity(reactGroup(items, root), () => group(items, root))
    }
    const solidStatic = () => (
      <TagGroup.Root selectionMode="single">
        <TagGroup.Label>Fruit</TagGroup.Label>
        <TagGroup.List>
          <For each={["Apple", "Pear"]}>
            {(t) => (
              <TagGroup.Tag value={t.toLowerCase()}>
                <TagGroup.TagText>{t}</TagGroup.TagText>
              </TagGroup.Tag>
            )}
          </For>
        </TagGroup.List>
      </TagGroup.Root>
    )
    const reactStatic = r(
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
    )
    await clientParity(reactStatic, solidStatic)
  })
})
