---
name: rind-ui
description: Build accessible React UI with rind-ui, a headless component library (behaviour, keyboard, ARIA and state, no styles), and verify it with rind-ui's test drivers. Use when the user asks for an accessible headless component library, when a project depends on @rind-ui/react, @rind-ui/testing or @rind-ui/theme, or when building dialogs, menus, selects, comboboxes, date fields, tables, tabs, chat UIs (prompt input, message thread, streaming message) or any interactive component that must work with keyboard and screen readers.
---

# rind-ui

rind-ui gives you behaviour, keyboard support, accessibility and state. It ships no styles:
you style its `data-*` attributes. Every component also ships a **test driver**, so you can
check what you built the way a user would use it.

## Find the API, never guess it

The API is generated from source. Read it before writing code:

- Index of every page: https://rind.watermelon-studio.it/llms.txt
- One component as markdown: `https://rind.watermelon-studio.it/docs/<component>.md`
  (for example `docs/combobox.md`): parts, props, `data-*` attributes, keyboard, driver.
- Everything in one file: https://rind.watermelon-studio.it/llms-full.txt
- With MCP: `npx -y @rind-ui/mcp` gives you `list_components`, `get_component`, `search_docs`.

## Install

```sh
pnpm add @rind-ui/react          # React 19+
pnpm add -D @rind-ui/testing     # drivers, for tests
```

## Compose with parts

Components are namespaces of parts. Render the parts you need, in the documented structure:

```tsx
import { Dialog, Switch } from "@rind-ui/react"

<Dialog.Root>
  <Dialog.Trigger>Settings</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Positioner>
      <Dialog.Content>
        <Dialog.Title>Settings</Dialog.Title>
        <Switch.Root>
          <Switch.Control><Switch.Thumb /></Switch.Control>
          <Switch.Label>Dark mode</Switch.Label>
        </Switch.Root>
        <Dialog.CloseTrigger>Done</Dialog.CloseTrigger>
      </Dialog.Content>
    </Dialog.Positioner>
  </Dialog.Portal>
</Dialog.Root>
```

Rules:

- **Do not re-implement behaviour** (focus trap, roving focus, typeahead, dismiss on Escape or
  outside press, ARIA wiring). The component does it; adding your own breaks it.
- **Every part forwards the props of the element it renders** (`className`, `id`, handlers).
  To render another element, pass `render` (a React element or `(props, state) => node`).
- **Label everything.** Use the component's Label part or `aria-label` on groups that have none.
- Controlled and uncontrolled both work: `value` + `onValueChange`, or `defaultValue`.

## Style the attributes

```css
[data-scope="switch"][data-part="control"] { inline-size: 44px; border-radius: 99px; }
[data-scope="switch"][data-part="control"][data-state="checked"] { background: #0b0b0c; }
[data-focus-visible] { outline: 2px solid #ff3d8b; outline-offset: 2px; }
```

Each part carries `data-scope`, `data-part`, its state (`data-state`, `data-disabled`,
`data-hover`, `data-focus-visible`, …) and the matching `aria-*`. Style focus with
`[data-focus-visible]`, never `:focus`. Want a starting look? `import "@rind-ui/theme"`.

## Verify with the drivers

After writing UI, check it through its driver. A driver is what a user does and asks, by
role and accessible name; it never depends on your markup.

```ts
// vitest.config.ts: test: { environment: "jsdom", setupFiles: ["@rind-ui/testing/setup"] }
import { getDialog, getSwitch } from "@rind-ui/testing"

const settings = getDialog(screen, { name: "Settings" })
await settings.open()
const dark = getSwitch(screen, { name: "Dark mode" })
await dark.toggle()
expect(await dark.isChecked()).toBe(true)
```

The same drivers run in Playwright from `@rind-ui/testing/playwright`. Each component's page
lists its driver's actions and queries.

## Before you finish

- Every interactive element is reachable and usable by keyboard.
- Every control and group has an accessible name.
- A driver test covers the main interaction of each component you added.
