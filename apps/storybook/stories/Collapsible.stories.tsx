import { Collapsible } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ComponentProps, useState } from "react"
import { expect } from "storybook/test"
import { getCollapsible } from "../../../packages/testing/src/components/collapsible"

const meta = {
  title: "Components/Collapsible",
  component: Collapsible.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof Collapsible.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = { collapsible: { closed: "Default", open: "InitiallyOpen" } }

export default meta
type Story = StoryObj<typeof meta>

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "24rem" } as const
const chevron = "▸"

/** Content padding lives on an inner wrapper, so overflow: hidden never clips a focus ring. */
function Section({
  title,
  children,
  ...root
}: { title: string } & Omit<ComponentProps<typeof Collapsible.Root>, "title">) {
  return (
    <Collapsible.Root {...root}>
      <Collapsible.Trigger>
        <Collapsible.Indicator>{chevron}</Collapsible.Indicator>
        {title}
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div style={{ padding: "var(--rind-space-2)" }}>{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export const Default: Story = {
  render: () => <Section title="Details">Some content that can be hidden.</Section>,
}

export const InitiallyOpen: Story = {
  render: () => (
    <Section title="Details" defaultOpen>
      Open from the first render, with no transition.
    </Section>
  ),
}

export const Disabled: Story = {
  render: () => (
    <div style={column}>
      <Section title="Disabled closed" disabled>
        Never shown.
      </Section>
      <Section title="Disabled open" disabled defaultOpen>
        Stays open.
      </Section>
    </div>
  ),
}

export const ClosedContentUntilFound: Story = {
  render: () => (
    <Section title="until-found (default)" closedContent="until-found">
      Findable by the browser's search.
    </Section>
  ),
}

export const ClosedContentHidden: Story = {
  render: () => (
    <Section title="hidden" closedContent="hidden">
      Kept in the document, not findable.
    </Section>
  ),
}

export const ClosedContentUnmount: Story = {
  render: () => (
    <Section title="unmount" closedContent="unmount">
      Removed while closed.
    </Section>
  ),
}

export const Controlled: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <div style={column}>
        <Section title="Controlled" open={open} onOpenChange={setOpen}>
          Driven by state.
        </Section>
        <p>{open ? "Open" : "Closed"}</p>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          Toggle from outside
        </button>
      </div>
    )
  },
}

export const Nested: Story = {
  render: () => (
    <Section title="Outer" defaultOpen>
      <Section title="Inner">Nested content.</Section>
    </Section>
  ),
}

export const ListReorder: Story = {
  render: () => {
    const [items, setItems] = useState(["One", "Two", "Three"])
    return (
      <div style={column}>
        <button type="button" onClick={() => setItems((l) => [...l].reverse())}>
          Reverse
        </button>
        {items.map((name) => (
          <Section key={name} title={name}>
            Content of {name}.
          </Section>
        ))}
      </div>
    )
  },
}

/** Use the browser's find-in-page for "needle": the closed section opens. */
export const FindInPage: Story = {
  render: () => (
    <div>
      <div style={{ height: "120vh" }}>Scroll down.</div>
      <Section title="Hidden section">The needle is inside closed content.</Section>
      <div style={{ height: "40vh" }} />
    </div>
  ),
}

/** The driver opens and closes the way a user would. */
export const DriverExample: Story = {
  render: () => <Section title="Driven">Driven content.</Section>,
  play: async ({ canvasElement }) => {
    const section = getCollapsible(canvasElement, { name: "Driven" })
    await expect(section.isOpen()).resolves.toBe(false)
    await section.open()
    await expect(section.isOpen()).resolves.toBe(true)
    await section.close()
    await expect(section.isOpen()).resolves.toBe(false)
  },
}
