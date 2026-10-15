import { domEnvironment } from "@rind-ui/core"
import { Heading, Portal, useHeadingLevel } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactNode } from "react"
import { expect } from "storybook/test"
import { getHeading } from "../../../packages/testing/src/components/heading"

const meta = {
  title: "Components/Heading",
  component: Heading,
  excludeStories: ["states"],
} satisfies Meta<typeof Heading>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  heading: { nested: "NestedSections", asDiv: "AsDiv" },
}

export default meta
type Story = StoryObj<typeof meta>

// Stories that skip levels on purpose (a lone h4, an h6 with no parents) turn off axe's
// `heading-order` only: `empty-heading` and every other rule stay on.
const skipsLevels = {
  a11y: { config: { rules: [{ id: "heading-order", enabled: false }] } },
}

/** A bare Heading is level 2 (the page has the h1); each `Heading.Level` goes one deeper. */
const nested = () => (
  <>
    <Heading>Settings</Heading>
    <Heading.Level>
      <Heading>Profile</Heading>
      <Heading.Level>
        <Heading>Avatar</Heading>
      </Heading.Level>
    </Heading.Level>
  </>
)

export const NestedSections: Story = { render: nested }

/** An app shell anchors the outline: its root `Heading.Level level={1}` makes the first heading an h1. */
export const AnchoredRoot: Story = {
  render: () => (
    <Heading.Level level={1}>
      <Heading>Dashboard</Heading>
      <Heading.Level>
        <Heading>Activity</Heading>
      </Heading.Level>
    </Heading.Level>
  ),
}

/** A consumer component that renders its own tag from the level in context. */
function CardTitle({ children }: { children: ReactNode }) {
  const level = useHeadingLevel()
  const Tag = `h${level}` as const
  return <Tag>{children}</Tag>
}

export const CardTitles: Story = {
  render: () => (
    <Heading.Level level={2}>
      <Heading>Projects</Heading>
      <Heading.Level>
        <section>
          <CardTitle>Website</CardTitle>
        </section>
        <section>
          <CardTitle>Mobile app</CardTitle>
        </section>
      </Heading.Level>
    </Heading.Level>
  ),
}

/** React context crosses a portal: the heading in the portal is one level below its section. */
export const InPopover: Story = {
  render: () => (
    <Heading.Level level={2}>
      <Heading>Inbox</Heading>
      <Heading.Level>
        <Portal>
          <Heading>Message details</Heading>
        </Portal>
      </Heading.Level>
    </Heading.Level>
  ),
}

/** A non-heading element gets `role="heading"` and `aria-level`. */
export const AsDiv: Story = {
  render: () => <Heading render={<div />}>Section title</Heading>,
}

/** Level 2 on an `h4` tag: the explicit `aria-level` wins, so it is still exposed at level 2. */
export const AsH4: Story = {
  parameters: skipsLevels,
  render: () => (
    // biome-ignore lint/a11y/useHeadingContent: Heading supplies the children
    <Heading level={2} render={<h4 />}>
      Level 2 on an h4
    </Heading>
  ),
}

/** Six nested sections: the sixth heading is h6 (and a dev warning says the outline is deep). */
export const DepthWarning: Story = {
  parameters: skipsLevels,
  render: () => (
    <Heading.Level level={1}>
      <Heading.Level>
        <Heading.Level>
          <Heading.Level>
            <Heading.Level>
              <Heading.Level>
                <Heading.Level>
                  <Heading>Too deep</Heading>
                </Heading.Level>
              </Heading.Level>
            </Heading.Level>
          </Heading.Level>
        </Heading.Level>
      </Heading.Level>
    </Heading.Level>
  ),
}

/** Size is not level: the card shrinks its h2 to the level-4 size and the outline is unchanged. */
export const SizeOverride: Story = {
  render: () => (
    <Heading.Level level={2}>
      <div
        style={
          {
            "--rind-heading-2-font-size": "calc(var(--rind-text-sm) * 1.2143)",
          } as React.CSSProperties
        }
      >
        <Heading>Card title</Heading>
      </div>
      <Heading>Normal title</Heading>
    </Heading.Level>
  ),
}

export const DriverExample: Story = {
  render: nested,
  play: async ({ canvasElement }) => {
    const env = { platform: domEnvironment().platform }
    await expect(getHeading(canvasElement, { name: "Profile" }, env).level()).resolves.toBe(3)
  },
}
