import { VisuallyHidden } from "@rind-ui/react"
import type { Meta, StoryObj } from "@storybook/react-vite"

const meta = { title: "Foundations/VisuallyHidden", component: VisuallyHidden } satisfies Meta<
  typeof VisuallyHidden
>
export default meta
type Story = StoryObj<typeof meta>

/** An icon button named by a visually hidden label. */
export const IconButtonLabel: Story = {
  render: () => (
    <button type="button">
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16">
        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" />
      </svg>
      <VisuallyHidden>Close</VisuallyHidden>
    </button>
  ),
}

/** A skip link: visible only while it has keyboard focus. */
export const SkipLink: Story = {
  render: () => (
    <>
      <VisuallyHidden focusable render={<a href="#main" />}>
        Skip to content
      </VisuallyHidden>
      <main id="main">Content</main>
    </>
  ),
}
