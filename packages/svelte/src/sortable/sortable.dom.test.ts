// The Sortable contract model (React's: pick up, move, drop, cancel and quick moves by
// keyboard) against the Svelte parts, and DOM parity.
import { sortableContract, sortableMessages } from "@rind-ui/core"
import * as R from "@rind-ui/react"
import { domEnv, testMachine } from "@rind-ui/testing"
import axe from "axe-core"
import { createElement as r } from "react"
import { describe, it } from "vitest"
import { mount } from "../../fixtures/mount"
import { clientParity } from "../../fixtures/parity"
import Fruits from "../../fixtures/sortable/fruits.svelte"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}
const LABELS: Record<string, string> = { apple: "Apple", banana: "Banana", cherry: "Cherry" }
const KEYS = ["apple", "banana", "cherry"]

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
describe("svelte sortable model", () => {
  testMachine(sortableContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () => mount(Fruits, { extras: false } as never),
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

describe("Svelte Sortable matches React", () => {
  it("vertical, horizontal, handle-free", async () => {
    for (const p of [{}, { orientation: "horizontal" }, { handle: false }]) {
      await clientParity(reactList(KEYS, p), Fruits, {
        ...p,
        extras: false,
        provider: false,
      } as never)
    }
  })
})
