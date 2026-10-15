import { domEnvironment } from "@rind-ui/core"
import { Link, RouterProvider } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect } from "storybook/test"
import { getLink } from "../../../packages/testing/src/components/link"
import { fakeRouter, navigationLog } from "../../../packages/testing/src/navigation"

// Stories never navigate the Storybook page: every Link sits under a router whose
// `navigate` only records, and hrefs are in-page ("#...") or open another tab.
function Recording({ children }: { children: React.ReactNode }) {
  const [router] = useState(() => fakeRouter())
  const [calls, setCalls] = useState<string[]>([])
  return (
    <RouterProvider
      navigate={(href, options) => {
        router.navigate(href, options)
        setCalls((c) => [...c, String(href)])
      }}
    >
      {children}
      <p data-testid="calls">Router calls: {calls.length === 0 ? "none" : calls.join(", ")}</p>
    </RouterProvider>
  )
}

const meta = {
  title: "Components/Link",
  component: Link,
  args: { href: "#docs", children: "Documentation" },
  decorators: [(Story) => <Recording>{Story()}</Recording>],
  excludeStories: ["states"],
} satisfies Meta<typeof Link>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  link: { enabled: "Standalone", current: "Current", disabled: "Disabled", fallback: "AsDiv" },
}

export default meta
type Story = StoryObj<typeof meta>

export const Inline: Story = {
  render: () => (
    <p style={{ maxWidth: "40ch" }}>
      Read the <Link href="#guide">getting started guide</Link> before you theme anything, then
      browse the <Link href="#reference">API reference</Link>.
    </p>
  ),
}

export const Standalone: Story = {}

export const External: Story = {
  args: { href: "https://example.org", target: "_blank", children: "Example (opens in a new tab)" },
}

export const Current: Story = { args: { current: "page" } }

export const Disabled: Story = { args: { disabled: true } }

export const FocusableWhenDisabled: Story = {
  args: { disabled: true, focusableWhenDisabled: true },
}

/** No `href`-capable tag: a div gets role="link" and tabindex. */
export const AsDiv: Story = { args: { render: <div /> } }

export const Danger: Story = {
  render: (args) => (
    <div data-tone="danger" style={{ display: "grid", gap: "var(--rind-space-2)" }}>
      <Link {...args}>Delete account</Link>
      <Link {...args} current="page">
        Current
      </Link>
      <Link {...args} disabled>
        Disabled
      </Link>
      <Link {...args} focusableWhenDisabled disabled>
        Focusable when disabled
      </Link>
    </div>
  ),
}

/**
 * A router-like Link component, as react-router's: it runs the props' onClick first, then
 * navigates itself unless that prevented it or a modifier is held. The RouterProvider's
 * router is never called for it.
 */
function RouterLink({
  to,
  onClick,
  children,
  ...rest
}: { to: string } & React.ComponentPropsWithoutRef<"a">) {
  return (
    <a
      {...rest}
      href={to}
      onClick={(e) => {
        onClick?.(e)
        if (
          e.defaultPrevented ||
          e.button !== 0 ||
          e.metaKey ||
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey
        )
          return
        e.preventDefault()
        navigationLog().push({ href: to, newTab: false, via: "router" })
      }}
    >
      {children}
    </a>
  )
}
export const RenderRouterLink: Story = {
  render: (args) => <Link {...args} render={<RouterLink to="/docs" />} />,
}

export const Rtl: Story = {
  render: (args) => (
    <div dir="rtl" lang="ar">
      <Link {...args}>الوثائق</Link>
    </div>
  ),
}

/** The driver: one router call per `follow`, whichever way it is done. */
export const FollowedWithDriver: Story = {
  args: { href: "/docs" },
  play: async ({ canvasElement, canvas }) => {
    const link = getLink(
      canvasElement,
      { name: "Documentation" },
      { platform: domEnvironment().platform },
    )
    await link.follow()
    await expect(canvas.getByTestId("calls")).toHaveTextContent("Router calls: /docs")
    await link.via("keyboard").follow()
    await expect(canvas.getByTestId("calls")).toHaveTextContent("Router calls: /docs, /docs")
    await link.followInNewTab()
    await expect(canvas.getByTestId("calls")).toHaveTextContent("Router calls: /docs, /docs")
  },
}

export const Queries: Story = {
  args: { href: "https://example.org", current: "page", target: "_blank" },
  play: async ({ canvasElement }) => {
    const link = getLink(
      canvasElement,
      { name: "Documentation" },
      { platform: domEnvironment().platform },
    )
    await expect(link.isExternal()).resolves.toBe(true)
    await expect(link.current()).resolves.toBe("page")
    await expect(link.isDisabled()).resolves.toBe(false)
    await expect(link.href()).resolves.toBe("https://example.org")
  },
}

export const DisabledQuery: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const link = getLink(
      canvasElement,
      { name: "Documentation" },
      { platform: domEnvironment().platform },
    )
    await expect(link.isDisabled()).resolves.toBe(true)
  },
}
