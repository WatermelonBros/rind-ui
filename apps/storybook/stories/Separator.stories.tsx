import { domEnvironment } from "@rind-ui/core"
import { Separator, SeparatorHostContext } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import { getSeparator } from "../../../packages/testing/src/components/separator"

const meta = {
  title: "Components/Separator",
  component: Separator.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof Separator.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per story). */
export const states = {
  separator: {
    horizontal: "Horizontal",
    vertical: "VerticalInRow",
    decorative: "Decorative",
    labelled: "Labelled",
    toolbar: "InToolbar",
    menu: "InMenu",
    listbox: "InListbox",
  },
}

export default meta
type Story = StoryObj<typeof meta>

const column = { display: "grid", maxWidth: "24rem" } as const
const row = { display: "flex", alignItems: "center", gap: "var(--rind-space-2)" } as const

export const Horizontal: Story = {
  render: () => (
    <div style={column}>
      <p>Account</p>
      <Separator.Root />
      <p>Billing</p>
    </div>
  ),
}

/** A vertical separator stretches to the height of the flex row. */
export const VerticalInRow: Story = {
  render: () => (
    <div style={{ ...row, alignItems: "stretch" }}>
      <button type="button">Docs</button>
      <Separator.Root orientation="vertical" />
      <button type="button">Blog</button>
    </div>
  ),
}

/** Purely visual: `role="none"`, nothing in the accessibility tree. */
export const Decorative: Story = {
  render: () => (
    <div style={column}>
      <p>Above</p>
      <Separator.Root decorative />
      <p>Below</p>
    </div>
  ),
}

/** `hr` renders without children and keeps its implicit separator role. */
export const AsHr: Story = {
  render: () => (
    <div style={column}>
      <p>Above</p>
      <Separator.Root render={<hr />} />
      <p>Below</p>
    </div>
  ),
}

export const Labelled: Story = {
  render: () => (
    <div style={column}>
      <p>Basic</p>
      <Separator.Root aria-label="Advanced settings" />
      <p>Network</p>
    </div>
  ),
}

/** A toolbar tells its separators to be perpendicular to it. */
export const InToolbar: Story = {
  render: () => (
    <div role="toolbar" aria-label="Format" style={row}>
      <SeparatorHostContext value={{ context: "toolbar", defaultOrientation: "vertical" }}>
        <button type="button">Bold</button>
        <Separator.Root style={{ alignSelf: "stretch" }} />
        <button type="button">Italic</button>
      </SeparatorHostContext>
    </div>
  ),
}

export const InMenu: Story = {
  render: () => (
    <div role="menu" aria-label="Edit" style={column}>
      <SeparatorHostContext value={{ context: "menu" }}>
        <div role="menuitem" tabIndex={-1}>
          Cut
        </div>
        <div role="menuitem" tabIndex={-1}>
          Copy
        </div>
        <Separator.Root />
        <div role="menuitem" tabIndex={-1}>
          Delete
        </div>
      </SeparatorHostContext>
    </div>
  ),
}

/** `separator` is not an allowed child of a listbox: the role is always `none`. */
export const InListbox: Story = {
  render: () => (
    <div role="listbox" aria-label="Fruit" style={column}>
      <SeparatorHostContext value={{ context: "listbox" }}>
        <div role="option" aria-selected="false" tabIndex={-1}>
          Apple
        </div>
        <Separator.Root />
        <div role="option" aria-selected="false" tabIndex={-1}>
          Pear
        </div>
      </SeparatorHostContext>
    </div>
  ),
}

/** The text sits beside two decorative rules: the separator itself holds no text. */
export const TextDivider: Story = {
  render: () => (
    <div style={{ ...row, maxWidth: "24rem" }}>
      <Separator.Root decorative style={{ flex: 1 }} />
      <span>or</span>
      <Separator.Root decorative style={{ flex: 1 }} />
    </div>
  ),
}

export const DriverExample: Story = {
  render: () => (
    <div role="toolbar" aria-label="Tools">
      <SeparatorHostContext value={{ context: "toolbar", defaultOrientation: "vertical" }}>
        <Separator.Root />
      </SeparatorHostContext>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const env = { platform: domEnvironment().platform }
    const toolbar = canvasElement.querySelector<HTMLElement>('[role="toolbar"]') as HTMLElement // rendered by this story
    const s = getSeparator(canvasElement, { within: toolbar }, env)
    await expect(s.orientation()).resolves.toBe("vertical")
    await expect(s.isDecorative()).resolves.toBe(false)
  },
}
