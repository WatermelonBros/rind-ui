// Model-based tests (add-sortable 2.2): pick up, move, drop, cancel and quick moves by keyboard;
// axe after every step.
import { sortableContract, sortableMessages } from "@rind-ui/core"
import { RindProvider, Sortable } from "@rind-ui/react"
import { render } from "@testing-library/react"
import axe from "axe-core"
import { useState } from "react"
import { describe, it } from "vitest"
import { domEnv, testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const LABELS: Record<string, string> = { apple: "Apple", banana: "Banana", cherry: "Cherry" }

function Fruits() {
  const [items, setItems] = useState<readonly string[]>(["apple", "banana", "cherry"])
  return (
    <Sortable.Root aria-label="Fruits" items={items} onReorder={(keys) => setItems(keys)}>
      {items.map((k) => (
        <Sortable.Item key={k} value={k}>
          <Sortable.Handle />
          <span>{LABELS[k]}</span>
          <Sortable.MoveButton direction="up" />
          <Sortable.MoveButton direction="down" />
        </Sortable.Item>
      ))}
    </Sortable.Root>
  )
}

describe("sortable model", () => {
  testMachine(sortableContract, {
    test: (name: string, fn: () => Promise<void>) => it(name, fn, 20_000),
    setup: () =>
      render(
        <RindProvider>
          <Fruits />
        </RindProvider>,
      ),
    target: () => domEnv({ timeout: 200 }),
    anchor: [{ name: "Fruits" }],
    props: {
      id: "oracle",
      items: ["apple", "banana", "cherry"],
      labels: new Map(Object.entries(LABELS)),
      disabledKeys: new Set<string>(),
      messages: sortableMessages,
    } as never,
    // Picking up is a keyboard act (a pointer drags): the pointer paths are the DOM tests.
    modalities: ["keyboard"],
    a11y,
  } as never)
})
