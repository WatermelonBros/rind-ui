import { Button, Fieldset } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect } from "storybook/test"
import { getFieldset } from "../../../packages/testing/src/components/fieldset"

const meta = {
  title: "Components/Fieldset",
  component: Fieldset.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof Fieldset.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  fieldset: { default: "AddressGroup", disabled: "Disabled" },
}

export default meta
type Story = StoryObj<typeof meta>

const column = { display: "grid", gap: "var(--rind-space-2)", maxWidth: "24rem" } as const

/** Native inputs with labels: no Text Field yet. */
export const AddressGroup: Story = {
  render: () => (
    <Fieldset.Root>
      <Fieldset.Legend>Shipping address</Fieldset.Legend>
      <Fieldset.Description>Where we send the parcel.</Fieldset.Description>
      <div style={column}>
        <label>
          Street <input type="text" />
        </label>
        <label>
          City <input type="text" />
        </label>
      </div>
    </Fieldset.Root>
  ),
}

export const RadioSet: Story = {
  render: () => (
    <Fieldset.Root>
      <Fieldset.Legend>Delivery speed</Fieldset.Legend>
      <label>
        <input type="radio" name="speed" defaultChecked /> Standard
      </label>
      <label>
        <input type="radio" name="speed" /> Express
      </label>
    </Fieldset.Root>
  ),
}

export const Disabled: Story = {
  render: () => (
    <Fieldset.Root disabled>
      <Fieldset.Legend>Shipping address</Fieldset.Legend>
      <div style={column}>
        <label>
          Street <input type="text" />
        </label>
        <Button>Save</Button>
      </div>
    </Fieldset.Root>
  ),
}

/** The inner fieldset is enabled by itself, yet its controls follow the disabled ancestor. */
export const NestedDisabled: Story = {
  render: () => (
    <Fieldset.Root disabled>
      <Fieldset.Legend>Account</Fieldset.Legend>
      <Fieldset.Root>
        <Fieldset.Legend>Contact</Fieldset.Legend>
        <label>
          Phone <input type="tel" />
        </label>
        <Button>Call</Button>
      </Fieldset.Root>
    </Fieldset.Root>
  ),
}

/** A control in the first legend is exempt from the disabled state (HTML). */
export const LegendWithSelectAll: Story = {
  render: () => (
    <Fieldset.Root disabled>
      <Fieldset.Legend>
        <label>
          <input type="checkbox" /> Select all
        </label>
      </Fieldset.Legend>
      <label>
        <input type="checkbox" /> News
      </label>
      <label>
        <input type="checkbox" /> Offers
      </label>
    </Fieldset.Root>
  ),
}

export const Invalid: Story = {
  render: () => (
    <Fieldset.Root invalid>
      <Fieldset.Legend>Delivery speed</Fieldset.Legend>
      <label>
        <input type="radio" name="speed-invalid" /> Standard
      </label>
      <label>
        <input type="radio" name="speed-invalid" /> Express
      </label>
      <Fieldset.ErrorMessage>Choose a delivery speed.</Fieldset.ErrorMessage>
    </Fieldset.Root>
  ),
}

/** Another tag for the legend: the group is then named through `aria-labelledby`. */
export const SubstitutedLegend: Story = {
  render: () => (
    <Fieldset.Root>
      <Fieldset.Legend render={<div />}>Billing address</Fieldset.Legend>
      <label>
        Street <input type="text" />
      </label>
    </Fieldset.Root>
  ),
}

export const Danger: Story = {
  render: () => (
    <Fieldset.Root invalid data-tone="danger">
      <Fieldset.Legend>Payment</Fieldset.Legend>
      <label>
        Card <input type="text" />
      </label>
      <Fieldset.ErrorMessage>The card was declined.</Fieldset.ErrorMessage>
    </Fieldset.Root>
  ),
  play: async ({ canvasElement }) => {
    const fieldset = getFieldset(canvasElement, { name: "Payment" })
    await expect(fieldset.isInvalid()).resolves.toBe(true)
    await expect(fieldset.errors()).resolves.toBe("The card was declined.")
  },
}
