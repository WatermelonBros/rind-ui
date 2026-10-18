// Model-based tests: the Tag Group contract over the props classes of the spec (task 5.2):
// removable, selectable single and multiple, selectable and removable, actions, disabled tags
// and empty, in every modality and under rtl. Display-only groups have no Tab stop for the
// runner to enter; their roles are covered by the scenario tests.
import {
  createListCollection,
  platforms,
  type TagGroupProps,
  tagGroupContract,
  tagGroupIds,
  tagGroupTraits,
} from "@rind-ui/core"
import { RindProvider, TagGroup, type TagGroupRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import { describe, it } from "vitest"
import { currentRun, testMachine } from "../index"

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

function config(name: string, cfg: Config) {
  const contract = {
    ...tagGroupContract,
    traits: tagGroupTraits(cfg),
  } as unknown as typeof tagGroupContract
  const items = cfg.items ?? CITIES
  const root = {
    selectionMode: cfg.selectionMode ?? "none",
    ...(cfg.removable ? { onRemove: () => {} } : {}),
    ...(cfg.actions ? { onAction: () => {} } : {}),
  } as TagGroupRootProps
  describe(`tag group model: ${name}`, () => {
    testMachine(contract, {
      test: it,
      setup: () =>
        render(
          <RindProvider
            environment={{ platform: currentRun()?.platform ?? platforms.linux }}
            dir={currentRun()?.direction === "rtl" ? "rtl" : "ltr"}
          >
            <TagGroup.Root items={items} {...root}>
              <TagGroup.Label>Cities</TagGroup.Label>
              <TagGroup.List>
                <TagGroup.Tags />
                <TagGroup.Empty>No cities</TagGroup.Empty>
              </TagGroup.List>
            </TagGroup.Root>
            <button type="button">After</button>
          </RindProvider>,
        ),
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
