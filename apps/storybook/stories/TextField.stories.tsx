import { Button, Field, Fieldset, TextField } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { useActionState, useState } from "react"
import { expect } from "storybook/test"
import { getTextField } from "../../../packages/testing/src/components/text-field"

const meta = {
  title: "Components/TextField",
  component: TextField.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof TextField.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  "text-field": { idle: "Input", filled: "Controlled" },
}

export default meta
type Story = StoryObj<typeof meta>

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "24rem" } as const

export const Input: Story = {
  render: () => (
    <TextField.Root>
      <TextField.Label>Name</TextField.Label>
      <TextField.Input placeholder="Ada Lovelace" />
    </TextField.Root>
  ),
}

export const Textarea: Story = {
  render: () => (
    <TextField.Root>
      <TextField.Label>Notes</TextField.Label>
      <TextField.Textarea rows={3} />
    </TextField.Root>
  ),
}

/** The Textarea grows with its content. */
export const Autosize: Story = {
  render: () => (
    <TextField.Root defaultValue={"One line\nTwo lines\nThree lines"}>
      <TextField.Label>Message</TextField.Label>
      <TextField.Textarea autosize rows={1} />
    </TextField.Root>
  ),
}

export const WithDescriptionAndError: Story = {
  render: () => (
    <form style={column}>
      <TextField.Root name="username" required>
        <TextField.Label>Username</TextField.Label>
        <TextField.Input />
        <TextField.Description>Letters and numbers only.</TextField.Description>
        <TextField.ErrorMessage />
      </TextField.Root>
      <Button type="submit">Submit</Button>
    </form>
  ),
}

export const RequiredEmail: Story = {
  render: () => (
    <form style={column}>
      <TextField.Root name="email" required>
        <TextField.Label>Email</TextField.Label>
        <TextField.Input type="email" />
        <TextField.ErrorMessage />
      </TextField.Root>
      <Button type="submit">Send</Button>
    </form>
  ),
}

const magnifier = (
  <svg
    aria-hidden="true"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
)

/** A search box: a leading icon, and a ClearTrigger that appears once there is text. */
export const SearchBox: Story = {
  render: () => (
    <TextField.Root defaultValue="rind">
      <TextField.Label>Search</TextField.Label>
      <div style={{ display: "grid", alignItems: "center" }}>
        <span
          style={{
            gridArea: "1 / 1",
            paddingInlineStart: "var(--rind-space-3)",
            display: "flex",
            pointerEvents: "none",
          }}
        >
          {magnifier}
        </span>
        <TextField.Input style={{ gridArea: "1 / 1", paddingInline: "2.25rem" }} />
        <span style={{ gridArea: "1 / 1", justifySelf: "end", paddingInlineEnd: "0.25rem" }}>
          <TextField.ClearTrigger />
        </span>
      </div>
    </TextField.Root>
  ),
}

/** A hard limit (`maxLength`): typing stops at the limit. */
export const CharacterCountHard: Story = {
  render: () => (
    <TextField.Root defaultValue="Hello">
      <TextField.Label>Handle</TextField.Label>
      <TextField.Input maxLength={12} />
      <TextField.CharacterCount />
    </TextField.Root>
  ),
}

/** A soft limit (`max`): going over is allowed, flagged and reported as invalid. */
export const CharacterCountSoft: Story = {
  render: () => (
    <TextField.Root defaultValue="This bio is a little too long">
      <TextField.Label>Bio</TextField.Label>
      <TextField.Textarea rows={2} />
      <TextField.CharacterCount max={20} />
    </TextField.Root>
  ),
}

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState("Hello")
    return (
      <div style={column}>
        <TextField.Root value={value} onValueChange={setValue}>
          <TextField.Label>Greeting</TextField.Label>
          <TextField.Input />
        </TextField.Root>
        <p>Value: {value}</p>
      </div>
    )
  },
}

export const ReadOnly: Story = {
  render: () => (
    <TextField.Root readOnly defaultValue="Read only">
      <TextField.Label>Reference</TextField.Label>
      <TextField.Input />
    </TextField.Root>
  ),
}

/** Disabled yet reachable by keyboard, so its explanation can be found. */
export const FocusableDisabled: Story = {
  render: () => (
    <TextField.Root disabled focusableWhenDisabled defaultValue="Locked">
      <TextField.Label>Plan</TextField.Label>
      <TextField.Input />
      <TextField.Description>Upgrade to change it.</TextField.Description>
    </TextField.Root>
  ),
}

/** Inside a Field, the Text Field joins it instead of creating another. */
export const InsideField: Story = {
  render: () => (
    <Field.Root name="company">
      <Field.Label>Company</Field.Label>
      <TextField.Root>
        <TextField.Input />
      </TextField.Root>
      <Field.Description>As on your invoice.</Field.Description>
    </Field.Root>
  ),
}

export const InsideFieldset: Story = {
  render: () => (
    <Fieldset.Root>
      <Fieldset.Legend>Shipping address</Fieldset.Legend>
      <div style={column}>
        <TextField.Root>
          <TextField.Label>Street</TextField.Label>
          <TextField.Input />
        </TextField.Root>
        <TextField.Root>
          <TextField.Label>City</TextField.Label>
          <TextField.Input />
        </TextField.Root>
      </div>
    </Fieldset.Root>
  ),
}

/** React 19: the form's action receives the FormData. */
export const ActionForm: Story = {
  render: () => {
    const [saved, save] = useActionState(
      async (_: string, data: FormData) => String(data.get("title") ?? ""),
      "",
    )
    return (
      <form action={save} style={column}>
        <TextField.Root name="title">
          <TextField.Label>Title</TextField.Label>
          <TextField.Input />
        </TextField.Root>
        <Button type="submit">Save</Button>
        <p>Saved: {saved}</p>
      </form>
    )
  },
}

const variants = ["outline", "soft"] as const
const sizes = ["sm", "md", "lg"] as const
export const Variants: Story = {
  render: () => (
    <div style={{ display: "grid", gap: "var(--rind-space-3)" }}>
      {variants.map((variant) => (
        <div
          key={variant}
          style={{ display: "flex", gap: "var(--rind-space-3)", flexWrap: "wrap" }}
        >
          {sizes.map((size) => (
            <TextField.Root
              key={size}
              data-variant={variant}
              data-size={size}
              defaultValue={`${variant} ${size}`}
            >
              <TextField.Label>{`${variant} ${size}`}</TextField.Label>
              <TextField.Input />
            </TextField.Root>
          ))}
        </div>
      ))}
    </div>
  ),
}

/** The driver fills the field the way a user would. */
export const DriverExample: Story = {
  render: () => (
    <TextField.Root>
      <TextField.Label>Driven</TextField.Label>
      <TextField.Input />
    </TextField.Root>
  ),
  play: async ({ canvasElement }) => {
    const field = getTextField(canvasElement, { name: "Driven" })
    await field.fill("hello")
    await expect(field.value()).resolves.toBe("hello")
  },
}
