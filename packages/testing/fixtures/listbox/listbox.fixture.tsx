import { Listbox, type ListboxItemData, type RootProps } from "./listbox.react"

export const FRUITS: readonly ListboxItemData[] = [
  { key: "apple", label: "Apple" },
  { key: "banana", label: "Banana" },
  { key: "cherry", label: "Cherry" },
  { key: "date", label: "Date" },
  { key: "elderberry", label: "Elderberry" },
]

/** A labelled listbox over `items` (data mode), with a button after it to Tab to. */
export function ListboxExample({
  label = "Fruit",
  items = FRUITS,
  ...props
}: Omit<RootProps, "children"> & { label?: string }) {
  return (
    <div>
      <span id="listbox-label">{label}</span>
      <Listbox.Root {...(props.collection ? {} : { items })} {...props}>
        <Listbox.List aria-labelledby="listbox-label">
          <Listbox.Items />
        </Listbox.List>
      </Listbox.Root>
      <button type="button">After</button>
    </div>
  )
}
