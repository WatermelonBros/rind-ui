import { Dialog } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { type ComponentProps, type ReactNode, useState } from "react"
import { expect } from "storybook/test"
import { getDialog } from "../../../packages/testing/src/components/dialog"

const meta = {
  title: "Components/Dialog",
  component: Dialog.Root,
  excludeStories: ["states"],
} satisfies Meta<typeof Dialog.Root>

/** State stories: contract scope → state → story export (ARIA snapshot per state). */
export const states = {
  dialog: { open: "Open", closed: "Closed" },
}

export default meta
type Story = StoryObj<typeof meta>

const column = { display: "grid", gap: "var(--rind-space-3)", maxWidth: "32rem" } as const

interface BoxProps extends Omit<ComponentProps<typeof Dialog.Root>, "children"> {
  readonly label?: string
  readonly title?: string
  readonly description?: string
  readonly children?: ReactNode
  readonly contentProps?: ComponentProps<typeof Dialog.Content>
  readonly positionerProps?: ComponentProps<typeof Dialog.Positioner>
}

/** A trigger and a portalled backdrop + content with a title, a description and a close. */
function Box({
  label = "Edit profile",
  title = label,
  description = "Make changes to your profile here.",
  children,
  contentProps,
  positionerProps,
  ...root
}: BoxProps) {
  return (
    <Dialog.Root {...root}>
      <Dialog.Trigger>{label}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner {...positionerProps}>
          <Dialog.Content {...contentProps}>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>{description}</Dialog.Description>
            {children ?? <input aria-label="Display name" defaultValue="Ada" />}
            <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const Default: Story = { render: () => <Box /> }

export const Closed: Story = { render: () => <Box /> }

export const Open: Story = { render: () => <Box defaultOpen /> }

export const Controlled: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <div style={column}>
        <p>Dialog is {open ? "open" : "closed"}</p>
        <button type="button" onClick={() => setOpen(true)}>
          Open from outside
        </button>
        <Box label="Settings" open={open} onOpenChange={setOpen} />
      </div>
    )
  },
}

/** `modal={false}`: no backdrop, the page stays usable, the trigger toggles. */
export const NonModal: Story = {
  render: () => (
    <div style={column}>
      <Box label="Notes" modal={false} description="Keep working on the page while this is open." />
      <label>
        Page field
        <input />
      </label>
    </div>
  ),
}

export const Nested: Story = {
  render: () => (
    <Box label="Open outer" title="Outer dialog" description="Opens another dialog.">
      <Box label="Open inner" title="Inner dialog" description="Escape closes only this one." />
    </Box>
  ),
}

/** Enter submits; a submit-type close trigger closes on the form's submit. */
export const FormInside: Story = {
  render: () => {
    const [saved, setSaved] = useState("none")
    return (
      <div style={column}>
        <p>Saved: {saved}</p>
        <Dialog.Root>
          <Dialog.Trigger>Rename</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    setSaved(String(new FormData(e.currentTarget).get("name")))
                  }}
                >
                  <Dialog.Title>Rename</Dialog.Title>
                  <input name="name" aria-label="Name" required defaultValue="Ada" />
                  <Dialog.CloseTrigger type="submit">Save</Dialog.CloseTrigger>
                </form>
              </Dialog.Content>
            </Dialog.Positioner>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    )
  },
}

const paragraphs = Array.from({ length: 40 }, (_, i) => i + 1)

/** Content taller than the viewport; focus starts on the title so reading begins at the top. */
export const LongContent: Story = {
  render: () => (
    <Box label="Terms" initialFocus="title" description="Read to the end.">
      {paragraphs.map((n) => (
        <p key={n}>Paragraph {n}. Lorem ipsum dolor sit amet, consectetur elit.</p>
      ))}
    </Box>
  ),
}

/** One dialog, two triggers: focus returns to the one that opened it. */
export const TwoTriggers: Story = {
  render: () => (
    <Dialog.Root>
      <Dialog.Trigger>First trigger</Dialog.Trigger>
      <Dialog.Trigger>Second trigger</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Title>Shared dialog</Dialog.Title>
            <Dialog.CloseTrigger>Close</Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Portal>
    </Dialog.Root>
  ),
}

/** `keepMounted`: the parts stay in the DOM (hidden) while closed. */
export const KeepMounted: Story = {
  render: () => <Box label="Keep mounted" keepMounted />,
}

const slowExit = `
@media (prefers-reduced-motion: no-preference) {
  [data-scope="dialog"][data-part="content"][data-slow-exit][data-state="closed"],
  [data-scope="dialog"][data-part="backdrop"][data-state="closed"] {
    animation: rind-story-dialog-exit 400ms linear forwards;
  }
}
@keyframes rind-story-dialog-exit { from { opacity: 1 } to { opacity: 0 } }`

/** A 400ms exit through `[data-state="closed"]`: the parts stay mounted until it ends. */
export const ExitAnimation: Story = {
  render: () => (
    <>
      <style>{slowExit}</style>
      <Box label="Slow exit" contentProps={{ "data-slow-exit": "" } as never} />
    </>
  ),
}

/** The driver opens and closes the dialog the way a user would. */
export const DriverExample: Story = {
  render: () => <Box />,
  play: async ({ canvasElement }) => {
    const dialog = getDialog(canvasElement, { name: "Edit profile" })
    await expect(dialog.isOpen()).resolves.toBe(false)
    await dialog.open()
    await expect(dialog.isOpen()).resolves.toBe(true)
    await expect(dialog.title()).resolves.toBe("Edit profile")
    await expect(dialog.description()).resolves.toBe("Make changes to your profile here.")
    await dialog.pressEscape()
    await expect(dialog.isOpen()).resolves.toBe(false)
    await dialog.via("keyboard").open()
    await dialog.via("keyboard").close()
    await expect(dialog.isOpen()).resolves.toBe(false)
  },
}
