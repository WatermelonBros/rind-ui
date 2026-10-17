// A consumer wrapper that drops aria-selected from unselected options fails the first step,
// naming the option and the attribute (spec "Model-Based Coverage").
import { createListCollection, listboxContract, listboxIds } from "@rind-ui/core"
import { Listbox } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { useLayoutEffect } from "react"
import { describe, expect, it } from "vitest"
import { domEnv, testMachine } from "../index"

const ITEMS = ["a", "b", "c"].map((k) => ({ key: k, label: k }))
const collection = createListCollection({
  items: ITEMS,
  getKey: (i) => i.key,
  getText: (i) => i.label,
})

/** The broken wrapper: after every render, unselected options lose aria-selected. */
function DropUnselected() {
  useLayoutEffect(() => {
    for (const o of document.querySelectorAll('[role="option"][aria-selected="false"]')) {
      o.removeAttribute("aria-selected")
    }
  })
  return null
}

async function failuresOf(broken: boolean) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(listboxContract, {
    test: (name: string, fn: () => Promise<void>) => tests.push({ name, fn }),
    setup: () =>
      render(
        <>
          <Listbox.Root items={ITEMS} selectionMode="single">
            <Listbox.Label>Fruit</Listbox.Label>
            <Listbox.List>
              <Listbox.Items />
            </Listbox.List>
          </Listbox.Root>
          <button type="button">After</button>
          {broken ? <DropUnselected /> : null}
        </>,
      ),
    target: () => domEnv({ timeout: 300 }),
    anchor: [{ name: "Fruit" }],
    props: {
      collection,
      ids: listboxIds("listbox", "o"),
      strategy: "roving",
      selectionMode: "single",
      // The guards read these: the oracle gets them explicitly.
      selectionBehavior: "toggle",
      onAction: undefined,
    },
    modalities: ["keyboard"],
  } as never)
  const out: (string | null)[] = []
  for (const t of tests) {
    out.push(
      await t.fn().then(
        () => null,
        (e: Error) => e.message,
      ),
    )
    document.body.innerHTML = ""
  }
  return out
}

describe("listbox broken variant", () => {
  it("the correct component passes", { timeout: 60_000 }, async () => {
    expect((await failuresOf(false)).filter(Boolean)).toEqual([])
  })

  it("dropping aria-selected fails, naming the option and the attribute", {
    timeout: 60_000,
  }, async () => {
    const errors = (await failuresOf(true)).filter(Boolean)
    expect(errors.length).toBeGreaterThan(0)
    // The failing item is named by its id and part, with the missing attribute.
    expect(
      errors.some((e) => /item-a\[data-part=item\]/.test(e ?? "") && /aria-selected/.test(e ?? "")),
    ).toBe(true)
  })
})
