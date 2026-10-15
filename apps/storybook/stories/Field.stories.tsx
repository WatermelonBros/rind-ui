import { Button, Field, Fieldset } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, within } from "storybook/test"
import { FieldInput } from "../../../packages/testing/fixtures/field/field-input"
import { getField } from "../../../packages/testing/src/components/field"

const meta = {
  title: "Components/Field",
  component: Field.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof Field.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  field: { idle: "Idle", valid: "Valid", invalid: "Invalid" },
}

export default meta
type Story = StoryObj<typeof meta>

const form = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "24rem" } as const

/** No Text Field yet: the fixture control implements the field-control contract. */
export const WithDescriptionAndError: Story = {
  render: () => (
    <form style={form}>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.Description>We never share it.</Field.Description>
        <Field.ErrorMessage />
      </Field.Root>
      <Button type="submit">Send</Button>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const field = getField(canvasElement, { label: "Email" })
    await userEvent.type(within(canvasElement).getByRole("textbox"), "abc")
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Send" }))
    await expect(field.isInvalid()).resolves.toBe(true)
    await expect(field.errors()).resolves.toHaveLength(1)
  },
}

/** Errors appear when the form is submitted, and clear as soon as the value is fixed. */
export const Submit: Story = {
  render: () => (
    <form style={form}>
      <Field.Root validationMode="submit">
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.ErrorMessage />
      </Field.Root>
      <Button type="submit">Send</Button>
    </form>
  ),
}

/** Errors appear when the control loses focus. */
export const Blur: Story = {
  render: () => (
    <form style={form}>
      <Field.Root validationMode="blur">
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.ErrorMessage />
      </Field.Root>
      <Button>Next</Button>
    </form>
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByRole("textbox")
    await userEvent.type(input, "abc")
    await userEvent.tab()
    await expect(getField(canvasElement, { label: "Email" }).isInvalid()).resolves.toBe(true)
  },
}

/** Errors appear as the user types. */
export const Change: Story = {
  render: () => (
    <form style={form}>
      <Field.Root validationMode="change">
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.ErrorMessage />
      </Field.Root>
    </form>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByRole("textbox"), "abc")
    await expect(getField(canvasElement, { label: "Email" }).isInvalid()).resolves.toBe(true)
  },
}

/** `aria` behaviour: no native bubble, the control only gets `aria-invalid`. */
export const AriaBehavior: Story = {
  render: () => (
    <form style={form}>
      <Field.Root validationBehavior="aria">
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.ErrorMessage />
      </Field.Root>
      <Button type="submit">Send</Button>
    </form>
  ),
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Type "taken": the check takes 500 ms (`data-validating`), then the error shows. */
export const AsyncValidate: Story = {
  render: () => (
    <form style={form}>
      <Field.Root
        validationMode="change"
        validate={async (value) => {
          await wait(500)
          return value === "taken" ? "That username is taken." : null
        }}
      >
        <Field.Label>Username</Field.Label>
        <FieldInput />
        <Field.Description>Try "taken".</Field.Description>
        <Field.ErrorMessage />
      </Field.Root>
    </form>
  ),
}

/** One message per constraint: `match` picks the validity key behind the error. */
export const MatchMessages: Story = {
  render: () => (
    <form style={form}>
      <Field.Root validationMode="change">
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
        <Field.ErrorMessage match="valueMissing">Enter your email.</Field.ErrorMessage>
        <Field.ErrorMessage match="typeMismatch">That is not an email address.</Field.ErrorMessage>
      </Field.Root>
    </form>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByRole("textbox"), "abc")
    await expect(getField(canvasElement, { label: "Email" }).errors()).resolves.toEqual([
      "That is not an email address.",
    ])
  },
}

export const Disabled: Story = {
  render: () => (
    <Field.Root disabled>
      <Field.Label>Email</Field.Label>
      <FieldInput type="email" defaultValue="ada@example.com" />
      <Field.Description>Managed by your administrator.</Field.Description>
    </Field.Root>
  ),
}

export const ReadOnly: Story = {
  render: () => (
    <Field.Root readOnly>
      <Field.Label>Email</Field.Label>
      <FieldInput type="email" defaultValue="ada@example.com" />
    </Field.Root>
  ),
}

export const Required: Story = {
  render: () => (
    <Field.Root required>
      <Field.Label>Email</Field.Label>
      <FieldInput type="email" />
      <Field.Description>Required.</Field.Description>
    </Field.Root>
  ),
}

export const InsideDisabledFieldset: Story = {
  render: () => (
    <Fieldset.Root disabled>
      <Fieldset.Legend>Contact</Fieldset.Legend>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" />
        <Field.Description>Locked with the group.</Field.Description>
      </Field.Root>
    </Fieldset.Root>
  ),
}

/** Without an ErrorMessage part the browser's own bubble reports the error. */
export const NoErrorMessage: Story = {
  render: () => (
    <form style={form}>
      <Field.Root>
        <Field.Label>Email</Field.Label>
        <FieldInput type="email" required />
      </Field.Root>
      <Button type="submit">Send</Button>
    </form>
  ),
}

export const Idle: Story = {
  render: () => (
    <Field.Root>
      <Field.Label>Email</Field.Label>
      <FieldInput type="email" />
      <Field.Description>We never share it.</Field.Description>
      <Field.ErrorMessage />
    </Field.Root>
  ),
}

export const Valid: Story = {
  render: () => (
    <Field.Root invalid={false}>
      <Field.Label>Email</Field.Label>
      <FieldInput type="email" defaultValue="ada@example.com" />
      <Field.Description>We never share it.</Field.Description>
      <Field.ErrorMessage />
    </Field.Root>
  ),
}

export const Invalid: Story = {
  render: () => (
    <Field.Root invalid>
      <Field.Label>Email</Field.Label>
      <FieldInput type="email" defaultValue="abc" />
      <Field.Description>We never share it.</Field.Description>
      <Field.ErrorMessage>Enter a valid email address.</Field.ErrorMessage>
    </Field.Root>
  ),
}
