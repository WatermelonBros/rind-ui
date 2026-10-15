// testMachine over the listbox fixture: every transition in every modality and direction,
// under each argument class (the collections that make guards true and false).

import { platforms } from "@rind-ui/core"
import { RindProvider } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, it } from "vitest"
import { currentRun, testMachine } from "../../src/index"
import { listboxIds } from "./listbox.connect"
import { changedCollection, listboxContract } from "./listbox.contract"
import { FRUITS, ListboxExample } from "./listbox.fixture"
import { fromData, type ListboxItemData } from "./listbox.react"

/** Renders as the run's platform (the `mod` key the driver presses). */
const AsRun = ({ children }: { children: ReactNode }) => (
  <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
    {children}
  </RindProvider>
)

const disable = (keys: readonly string[]) =>
  FRUITS.map((f) => (keys.includes(f.key) ? { ...f, disabled: true } : f))

const classes: Record<string, { items: readonly ListboxItemData[]; value?: readonly string[] }> = {
  ordinary: { items: FRUITS },
  single: { items: FRUITS.slice(0, 1) },
  "all disabled": { items: disable(FRUITS.map((f) => f.key)) },
  "disabled neighbour": { items: disable(["banana"]) },
  "section boundary": {
    items: FRUITS.map((f, i) => ({
      ...f,
      section: i < 2 ? { key: "a", label: "First" } : { key: "b", label: "Second" },
    })),
  },
  "selected disabled": { items: disable(["apple"]), value: ["apple"] },
}

for (const [name, { items, value }] of Object.entries(classes)) {
  describe(`listbox model: ${name}`, () => {
    const initial = fromData(items)
    // A collection change: the first item removed (repairs a highlight on it).
    const first = initial.firstKey()
    const changed = first === null ? initial : initial.remove(first)
    beforeEach(() => {
      changedCollection.current = changed
    })
    testMachine(listboxContract, {
      test: it,
      setup: () =>
        render(
          <ListboxExample
            collection={initial}
            selectionMode="multiple"
            {...(value ? { defaultValue: value } : {})}
          />,
          { wrapper: AsRun },
        ),
      target: () => screen,
      anchor: ["Fruit"],
      rerender: (props, rendered) =>
        rendered.rerender(
          <ListboxExample
            collection={props.collection}
            selectionMode="multiple"
            {...(value ? { defaultValue: value } : {})}
          />,
        ),
      props: {
        collection: initial,
        ids: listboxIds("oracle"),
        strategy: "roving",
        selectionMode: "multiple",
        ...(value ? { defaultValue: value } : {}),
      },
      modalities: ["pointer", "keyboard", "touch", "virtual"],
    })
  })
}
