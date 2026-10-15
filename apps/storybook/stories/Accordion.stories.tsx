import { Accordion, Heading } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ComponentProps, ReactNode } from "react"
import { expect } from "storybook/test"
import { getAccordion } from "../../../packages/testing/src/components/accordion"

const meta = {
  title: "Components/Accordion",
  component: Accordion.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof Accordion.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = { accordion: { idle: "Default" } }

export default meta
type Story = StoryObj<typeof meta>

const chevron = "▸"
const topics = ["Shipping", "Returns", "Payment"] as const

/** Content padding lives on an inner wrapper, so overflow: hidden never clips a focus ring. */
function Entry({
  value,
  title,
  children,
  ...item
}: { title: string; children?: ReactNode } & Omit<
  ComponentProps<typeof Accordion.Item>,
  "title" | "children"
>) {
  return (
    <Accordion.Item value={value} {...item}>
      <Accordion.Header>
        <Accordion.Trigger>
          {title}
          <Accordion.Indicator>{chevron}</Accordion.Indicator>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content>
        <div style={{ padding: "var(--rind-space-2)" }}>{children ?? `${title} details.`}</div>
      </Accordion.Content>
    </Accordion.Item>
  )
}

function Faq({
  names = topics,
  ...props
}: Omit<ComponentProps<typeof Accordion.Root>, "children"> & { names?: readonly string[] }) {
  return (
    <Accordion.Root {...props}>
      {names.map((t) => (
        <Entry key={t} value={t.toLowerCase()} title={t} />
      ))}
    </Accordion.Root>
  )
}

const column = { maxWidth: "24rem" } as const

export const Default: Story = {
  render: () => (
    <div style={column}>
      <Faq />
    </div>
  ),
}

export const Single: Story = {
  render: () => (
    <div style={column}>
      <Faq defaultValue={["shipping"]} />
    </div>
  ),
}

export const Multiple: Story = {
  render: () => (
    <div style={column}>
      <Faq multiple defaultValue={["shipping", "payment"]} />
    </div>
  ),
}

export const NonCollapsible: Story = {
  render: () => (
    <div style={column}>
      <Faq collapsible={false} defaultValue={["returns"]} />
    </div>
  ),
}

export const DisabledItem: Story = {
  render: () => (
    <div style={column}>
      <Accordion.Root>
        <Entry value="a" title="Available">
          Open me.
        </Entry>
        <Entry value="b" title="Unavailable" disabled>
          Never shown.
        </Entry>
      </Accordion.Root>
    </div>
  ),
}

export const HeadingLevels: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "var(--rind-space-4)", ...column }}>
      <Faq headingLevel={2} defaultValue={["shipping"]} />
      <Heading.Level level={3}>
        <Faq names={["Warranty", "Support"]} />
      </Heading.Level>
    </div>
  ),
}

const horizontal = (dir: "ltr" | "rtl") => (
  <div dir={dir} style={{ maxWidth: "48rem" }}>
    <Faq orientation="horizontal" keyboardNavigation dir={dir} defaultValue={["shipping"]} />
  </div>
)

export const HorizontalLtr: Story = { render: () => horizontal("ltr") }
export const HorizontalRtl: Story = { render: () => horizontal("rtl") }

export const KeyboardNavigation: Story = {
  render: () => (
    <div style={column}>
      <Faq keyboardNavigation />
    </div>
  ),
}

/** Use the browser's find-in-page for "needle": the closed item opens. */
export const FindInPage: Story = {
  render: () => (
    <div>
      <div style={{ height: "120vh" }}>Scroll down.</div>
      <div style={column}>
        <Faq />
        <Accordion.Root>
          <Entry value="faq" title="Hidden item">
            The needle is inside closed content.
          </Entry>
        </Accordion.Root>
      </div>
      <div style={{ height: "40vh" }} />
    </div>
  ),
}

export const Nested: Story = {
  render: () => (
    <div style={column}>
      <Accordion.Root defaultValue={["outer"]}>
        <Entry value="outer" title="Outer">
          <Faq />
        </Entry>
      </Accordion.Root>
    </div>
  ),
}

/** The driver expands and collapses the way a user would. */
export const DriverExample: Story = {
  render: () => (
    <div style={column}>
      <Faq />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const accordion = getAccordion(canvasElement, { item: "Shipping" })
    await expect(accordion.expanded()).resolves.toEqual([])
    await accordion.expand("Shipping")
    await expect(accordion.expanded()).resolves.toEqual(["Shipping"])
    await accordion.expand("Returns")
    await expect(accordion.expanded()).resolves.toEqual(["Returns"])
    await accordion.collapse("Returns")
    await expect(accordion.expanded()).resolves.toEqual([])
  },
}
