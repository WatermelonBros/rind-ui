import type { Meta, StoryObj } from "@storybook/react-vite"
// The add-a11y-foundations streaming fixture: announces "Hello there" once.
import { StreamFixture } from "../../../packages/testing/fixtures/announce/announce.react"

const meta = {
  title: "Foundations/Announce fixture",
  component: StreamFixture,
  excludeStories: ["states"],
} satisfies Meta<typeof StreamFixture>

/** State stories: contract scope → machine state → story export. */
export const states = { stream: { idle: "Stream" } }
export default meta
export const Stream: StoryObj<typeof meta> = {}
