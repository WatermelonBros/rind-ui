import { Button, RouterProvider } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { expect } from "storybook/test"
import { getButton } from "../../../packages/testing/src/components/button"
import { fakeRouter } from "../../../packages/testing/src/navigation"

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "Save" },
  excludeStories: ["states"],
} satisfies Meta<typeof Button>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  button: { idle: "Default", pending: "PendingState" },
}

export default meta
type Story = StoryObj<typeof meta>

const row = {
  display: "flex",
  gap: "var(--rind-space-2)",
  alignItems: "center",
  flexWrap: "wrap",
} as const

export const Default: Story = {}

const variants = ["solid", "soft", "outline", "ghost"] as const
const sizes = ["sm", "md", "lg"] as const
export const Variants: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "var(--rind-space-3)" }}>
      {variants.map((variant) => (
        <div key={variant} style={row}>
          {sizes.map((size) => (
            <Button key={size} data-variant={variant} data-size={size}>
              {variant} {size}
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
}

export const IconOnly: Story = {
  args: {
    "aria-label": "Close",
    children: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
}

export const Disabled: Story = { args: { disabled: true } }

export const FocusableWhenDisabled: Story = {
  args: { disabled: true, focusableWhenDisabled: true },
}

/** A Save that goes pending for two seconds; the label changes so sighted users see it too. */
export const Pending: Story = {
  render: (args) => {
    const [pending, setPending] = useState(false)
    return (
      <Button
        {...args}
        pending={pending}
        onPress={() => {
          setPending(true)
          setTimeout(() => setPending(false), 2000)
        }}
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    )
  },
}

export const PendingState: Story = { args: { pending: true, children: "Saving…" } }

export const AsLink: Story = {
  render: (args) => {
    const [router] = useState(() => fakeRouter())
    const [calls, setCalls] = useState(0)
    return (
      <RouterProvider
        navigate={(href, options) => {
          router.navigate(href, options)
          setCalls((c) => c + 1)
        }}
      >
        <Button {...args} render={<a href="#docs" />}>
          Documentation
        </Button>
        <p>Router calls: {calls}</p>
      </RouterProvider>
    )
  },
}

export const AsDiv: Story = { args: { render: <div /> } }

export const InsideForm: Story = {
  render: (args) => {
    const [submits, setSubmits] = useState(0)
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setSubmits((n) => n + 1)
        }}
      >
        <div style={row}>
          <input aria-label="Name" defaultValue="Ada" />
          <Button {...args} type="submit">
            Submit
          </Button>
          <Button {...args} type="reset" data-variant="outline">
            Reset
          </Button>
        </div>
        <p data-testid="submits">Submits: {submits}</p>
      </form>
    )
  },
}

export const Danger: Story = {
  render: (args) => (
    <div data-tone="danger" style={row}>
      {variants.map((variant) => (
        <Button key={variant} {...args} data-variant={variant}>
          Delete {variant}
        </Button>
      ))}
      <Button {...args} disabled>
        Disabled
      </Button>
    </div>
  ),
}

/** The driver: one press, observed through the counter. */
export const DriverExample: Story = {
  render: (args) => {
    const [count, setCount] = useState(0)
    return (
      <>
        <Button {...args} onPress={() => setCount((n) => n + 1)} />
        <p data-testid="count">Pressed: {count}</p>
      </>
    )
  },
  play: async ({ canvasElement, canvas }) => {
    await getButton(canvasElement, { name: "Save" }).press()
    await expect(canvas.getByTestId("count")).toHaveTextContent("Pressed: 1")
  },
}
