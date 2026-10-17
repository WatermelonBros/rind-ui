// Model-based tests (task 5.4): the Select contract over every transition in pointer, touch,
// keyboard and virtual, ltr and rtl, single / multiple / non-modal, with the layer,
// restores-focus, presence, anchored and (modal) modal invariants and axe per state.
import { createListCollection, selectArgs, selectContract, selectTraits } from "@rind-ui/core"
import { Select, type SelectRootProps } from "@rind-ui/react"
import { render, screen } from "@testing-library/react"
import axe from "axe-core"
import { describe, it } from "vitest"
import { testMachine } from "../index"

const a11y = async () => {
  const { violations } = await axe.run(document.body, {
    rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
  })
  if (violations.length > 0) throw new Error(violations.map((v) => `${v.id}: ${v.help}`).join("\n"))
}

const ITEMS = [
  { key: "apple", label: "Apple" },
  { key: "pear", label: "Pear" },
]

function Example(props: Partial<SelectRootProps>) {
  return (
    <div id="app">
      <Select.Root {...(props as SelectRootProps)} items={ITEMS} placeholder="Pick one">
        <Select.Label>Fruit</Select.Label>
        <Select.Trigger>
          <Select.ValueText />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Content>
              <Select.List>
                {ITEMS.map((i) => (
                  <Select.Item key={i.key} value={i.key}>
                    <Select.ItemText>{i.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Content>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <button type="button">After</button>
    </div>
  )
}

const collection = createListCollection({
  items: ITEMS,
  getKey: (i) => i.key,
  getText: (i) => i.label,
})

const classes = [
  { name: "single", multiple: false, modal: true },
  { name: "multiple", multiple: true, modal: true },
  { name: "non-modal", multiple: false, modal: false },
] as const

for (const c of classes) {
  describe(`select model: ${c.name}`, () => {
    selectArgs.current = { key: "pear", label: "Pear" }
    testMachine(
      { ...selectContract, traits: selectTraits({ modal: c.modal }) },
      {
        test: it,
        setup: () => render(<Example multiple={c.multiple as false} modal={c.modal} />),
        target: () => screen,
        anchor: [{ name: "Fruit" }] as never,
        // Internal props (set by Select.Root); the oracle only needs values.
        props: {
          open: undefined,
          modal: c.modal,
          collection,
          strategy: "roving",
          selectionMode: c.multiple ? "multiple" : "single",
          ids: { list: "oracle-list", item: (k: string) => `oracle-${k}` },
          root: "oracle",
          disabled: false,
          readOnly: false,
          selectionBehavior: "toggle",
          disallowEmptySelection: false,
          getTrigger: () => null,
        } as never,
        modalities: ["pointer", "keyboard", "touch", "virtual"],
        directions: ["ltr", "rtl"],
        a11y,
      },
    )
  })
}
