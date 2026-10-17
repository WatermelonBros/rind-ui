// A consumer wrapper whose options omit aria-selected when unselected fails the selectable
// invariant, naming the option (combobox "Combobox Contract").
import {
  comboboxContract,
  comboboxIds,
  comboboxMessages,
  createListCollection,
  platforms,
} from "@rind-ui/core"
import { Combobox, RindProvider } from "@rind-ui/react"
import { render } from "@testing-library/react"
import { useLayoutEffect } from "react"
import { describe, expect, it } from "vitest"
import { currentRun, domEnv, testMachine } from "../index"

const ITEMS = ["Rome", "Paris"].map((label) => ({ key: label.toLowerCase(), label }))
const collection = createListCollection({
  items: ITEMS,
  getKey: (i) => i.key,
  getText: (i) => i.label,
})

/** The broken wrapper: after every render, unselected options lose aria-selected. */
function DropUnselected() {
  useLayoutEffect(() => {
    const strip = () => {
      for (const o of document.querySelectorAll('[role="option"][aria-selected="false"]')) {
        o.removeAttribute("aria-selected")
      }
    }
    strip()
    const observer = new MutationObserver(strip)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true })
    return () => observer.disconnect()
  })
  return null
}

async function failuresOf(broken: boolean) {
  const tests: { name: string; fn: () => Promise<void> }[] = []
  testMachine(comboboxContract, {
    test: (name: string, fn: () => Promise<void>) => tests.push({ name, fn }),
    setup: () =>
      render(
        // The run's platform: the announcement gate and the invariant must agree on it.
        <RindProvider environment={{ platform: currentRun()?.platform ?? platforms.linux }}>
          <Combobox.Root items={ITEMS} filter={null}>
            <Combobox.Label>City</Combobox.Label>
            <Combobox.Control>
              <Combobox.Input />
              <Combobox.Trigger />
            </Combobox.Control>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Items />
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Root>
          <button type="button">After</button>
          {broken ? <DropUnselected /> : null}
        </RindProvider>,
      ),
    target: () => domEnv({ timeout: 300 }),
    anchor: [{ name: "City" }],
    props: {
      items: collection,
      collection,
      ids: comboboxIds("o"),
      strategy: "active-descendant",
      selectionMode: "single",
      locale: "en-US",
      messages: comboboxMessages,
      root: "o",
      disabled: undefined,
      readOnly: undefined,
      openOnInput: undefined,
      openOnArrow: undefined,
      openOnInputPress: undefined,
      openOnFocus: undefined,
      closeOnSelect: undefined,
      selectOnTab: undefined,
      keepHighlight: undefined,
      removeOnBackspace: undefined,
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

describe("combobox broken variant", () => {
  it("the correct component passes", { timeout: 120_000 }, async () => {
    const f = (await failuresOf(false)).filter(Boolean)
    console.log("DBG", f.slice(0, 2).join("\n----\n"))
    expect(f).toEqual([])
  })

  it("dropping aria-selected fails, naming the option and the attribute", {
    timeout: 120_000,
  }, async () => {
    const errors = (await failuresOf(true)).filter(Boolean)
    expect(errors.length).toBeGreaterThan(0)
    expect(
      errors.some((e) => /\[data-part=item\]/.test(e ?? "") && /aria-selected/.test(e ?? "")),
    ).toBe(true)
  })
})
