import "@rind-ui/theme"
import type { Preview } from "@storybook/react-vite"

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Colour scheme",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "system", title: "System" },
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "system" },
  decorators: [
    (Story, { globals }) => (
      <div
        className="rind-root"
        data-theme={globals["theme"] === "system" ? undefined : globals["theme"]}
        style={{ padding: "var(--rind-space-6)", minHeight: "100vh" }}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    // Fail stories on axe violations instead of only listing them.
    a11y: { test: "error" },
  },
}

export default preview
